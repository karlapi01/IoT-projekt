#include <ArduinoJson.h>

#include <WiFi.h>
#include <PubSubClient.h>


// ── WiFi ──────────────────────────────────────────
const char* WIFI_SSID = "GO AWAY\x21\x21\x21";
const char* WIFI_PASSWORD = "DonZvon2904";

// ── ThingsBoard MQTT ───────────────────────────────
const char* TB_HOST   = "161.53.133.253";
const int   TB_PORT   = 1883;
const char* TB_TOKEN  = "31sNPBEdHgB61J4kMfOr";

// ── Pinovi ────────────────────────────────────────
const int TRIG_PIN = 5;
const int ECHO_PIN = 18;
const int LED_PIN  = 2;

// ── Parametri detekcije ───────────────────────────
const float  DISTANCE_THRESHOLD_CM = 100.0;
const unsigned long PRESENCE_REQUIRED_MS = 5000;  

// ── MQTT ──────────────────────────────────────────
WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

// ── Stanje zona ───────────────────────────────────
bool zone1Active       = false;
bool zone2Active       = false;
unsigned long zone1StartTime = 0;
bool zone1Confirmed    = false;
bool zone2Confirmed    = false;

unsigned long lastSendTime    = 0;
const unsigned long SEND_INTERVAL = 2000;

unsigned long virtualTimer       = 0;
const unsigned long VIRTUAL_CYCLE = 30000;

// ─────────────────────────────────────────────────
float measureDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return 999.0;
  return duration * 0.034 / 2.0;
}

void updateZone1() {
  float dist = measureDistance();
  Serial.printf("[Zone1] Udaljenost: %.1f cm\n", dist);

  if (dist < DISTANCE_THRESHOLD_CM) {
    if (!zone1Active) {
      zone1Active    = true;
      zone1StartTime = millis();
    } else if (!zone1Confirmed && (millis() - zone1StartTime >= PRESENCE_REQUIRED_MS)) {
      zone1Confirmed = true;
      Serial.println("[Zone1] Osoba potvrđena!");
    }
  } else {
    zone1Active    = false;
    zone1Confirmed = false;
  }
}

void updateZone2Virtual() {
  unsigned long elapsed = millis() % (VIRTUAL_CYCLE * 2);
  zone2Confirmed = (elapsed < VIRTUAL_CYCLE);
}

void sendTelemetry() {
  JsonDocument doc;
  doc["zone1"] = zone1Confirmed;
  doc["zone2"] = zone2Confirmed;

  char payload[128];
  serializeJson(doc, payload);

  mqttClient.publish("v1/devices/me/telemetry", payload);
  Serial.printf("[MQTT] Poslano: %s\n", payload);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  Serial.printf("[RPC] Primljeno na %s: %s\n", topic, message.c_str());

  JsonDocument doc;
  if (deserializeJson(doc, message) != DeserializationError::Ok) return;

  String method = doc["method"] | "";
  if (method == "setLed") {
    bool ledState = doc["params"] | false;
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    Serial.printf("[LED] Postavljeno na: %s\n", ledState ? "ON" : "OFF");

    String responseTopic = String(topic);
    responseTopic.replace("request", "response");
    mqttClient.publish(responseTopic.c_str(), ledState ? "true" : "false");
  }
}

void connectWiFi() {
  Serial.print("[WiFi] Spajam se na: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int pokusaji = 0;
  while (WiFi.status() != WL_CONNECTED && pokusaji < 20) {
    delay(500);
    Serial.print(".");
    pokusaji++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Spojeno!");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] GREŠKA! Status: ");
    Serial.println(WiFi.status());
  }
}

void connectMQTT() {
  mqttClient.setServer(TB_HOST, TB_PORT);
  mqttClient.setCallback(mqttCallback);

  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Spajam se na ThingsBoard...");
    if (mqttClient.connect("ESP32_Client", TB_TOKEN, NULL)) {
      Serial.println(" OK!");
      mqttClient.subscribe("v1/devices/me/rpc/request/+");
    } else {
      Serial.printf(" Greška: %d. Pokušavam za 3s...\n", mqttClient.state());
      delay(3000);
    }
  }
}

void setup() {
  delay(2000);
  Serial.begin(115200);
  while(!Serial) delay(10);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN,  OUTPUT);

  connectWiFi();
  connectMQTT();
}

void loop() {
  if (!mqttClient.connected()) connectMQTT();
  mqttClient.loop();

  updateZone1();
  updateZone2Virtual();

  if (millis() - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = millis();
    sendTelemetry();
  }

  delay(100);
}