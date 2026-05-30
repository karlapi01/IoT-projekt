package org.redometar;

import com.google.gson.Gson;
import org.eclipse.paho.client.mqttv3.*;

import java.util.Map;

/*
MQTT komunikacija za jednu menzu (jedan device u ThingsBoardu)
Svaki CafeteriaWorker ima svoju instancu => svaka menza ima vlastitu konekciju i vlastiti token
Poruka je istog oblika kao ESP32: na topic v1/devices/me/telemetry
salje samo boolean stanja zona, npr. {"zone1":true,"zone2":false}
*/
public class MqttPublisher {

    private final MqttClient client;
    private final Gson gson = new Gson();

    private static final int QOS = 1;
    private static final boolean RETAINED = false;

    private static final String TELEMETRY_TOPIC = "v1/devices/me/telemetry";
    private static final String RPC_REQUEST_TOPIC = "v1/devices/me/rpc/request/+";

    public MqttPublisher(String brokerUrl, String clientId) throws MqttException {
        this.client = new MqttClient(brokerUrl, clientId, null);
        setupCallback();
    }

    private void setupCallback() {
        client.setCallback(new MqttCallback() {
            @Override
            public void connectionLost(Throwable cause) {
                System.err.println("[MQTT] Konekcija prekinuta: "
                        + (cause != null ? cause.getMessage() : "nepoznato"));
            }

            @Override
            public void messageArrived(String topic, MqttMessage message) {
                handleRpc(topic, new String(message.getPayload()));
            }

            @Override
            public void deliveryComplete(IMqttDeliveryToken token) { }
        });
    }

    public void connect(String token, String password) throws MqttException {
        MqttConnectOptions options = new MqttConnectOptions();
        options.setCleanSession(true);
        options.setAutomaticReconnect(true);
        options.setConnectionTimeout(10);
        options.setKeepAliveInterval(60);

        if (token != null && !token.isEmpty()) {
            options.setUserName(token);
        }
        if (password != null && !password.isEmpty()) {
            options.setPassword(password.toCharArray());
        }

        client.connect(options);

        try {
            client.subscribe(RPC_REQUEST_TOPIC, QOS);
        } catch (MqttException ignored) {
        }
    }

    public void publishZoneStates(Map<String, Boolean> zoneStates) throws MqttException {
        String json = gson.toJson(zoneStates);
        client.publish(TELEMETRY_TOPIC, json.getBytes(), QOS, RETAINED);
    }

    //obrada rpc-a, samo log jer ne postoje virtualne ledice
    private void handleRpc(String topic, String payload) {
        if (!topic.contains("rpc/request")) return;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = gson.fromJson(payload, Map.class);
            Object method = data.get("method");
            Object params = data.get("params");
            System.out.printf("[%s] RPC: method=%s params=%s%n",
                    client.getClientId(), method, params);

            String responseTopic = topic.replace("request", "response");
            client.publish(responseTopic, ("{\"received\":" + params + "}").getBytes(), QOS, RETAINED);
        } catch (Exception e) {
            System.err.println("[MQTT] RPC error: " + e.getMessage());
        }
    }

    public void disconnect() throws MqttException {
        if (client.isConnected()) {
            client.disconnect();
        }
        client.close();
    }
}