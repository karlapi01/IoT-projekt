package org.redometar;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import org.eclipse.paho.client.mqttv3.MqttException;
import java.util.LinkedHashMap;
import java.util.Map;

public class CafeteriaWorker implements Runnable {

    private final VirtualCafeteria cafeteria;
    private final MqttPublisher publisher;
    private final long sendMs;

    private static final long TICK_MS = 500; // ocitanje senzora (kao ESP32 petlja)

    private volatile boolean running = true;

    private static final Object PRINT_LOCK = new Object();
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");

    public CafeteriaWorker(CafeteriaConfig.Cafeteria cfg, String brokerUrl, int sendIntervalSeconds) throws MqttException {
        this.cafeteria = new VirtualCafeteria(cfg.id(), cfg.name(), cfg.zoneThresholds());
        this.sendMs = sendIntervalSeconds * 1000L;

        this.publisher = new MqttPublisher(brokerUrl, cfg.id() + "-sim");
        this.publisher.connect(cfg.token(), ""); 
    }

    @Override
    public void run() {
        long lastSend = 0;
        while (running && !Thread.currentThread().isInterrupted()) {
            try {
                cafeteria.update(); // jedno ocitanje

                long now = System.currentTimeMillis();
                if (now - lastSend >= sendMs) {
                    publishState();
                    printState();
                    lastSend = now;
                }

                Thread.sleep(TICK_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (MqttException e) {
                System.err.printf("[%s] MQTT error: %s%n", cafeteria.getCafeteriaId(), e.getMessage());
                sleepQuiet(3000);
            }
        }
    }

    // salje boolean stanja svih zona u jednoj poruci (kao ESP32) 
    private void publishState() throws MqttException {
        Map<String, Boolean> zones = new LinkedHashMap<>();
        for (ZoneSimulator zone : cafeteria.getZones()) {
            zones.put("zone" + zone.getZoneNumber(), zone.isOccupied());
        }
        publisher.publishZoneStates(zones);
    }

    private void printState() {
        StringBuilder zonesStr = new StringBuilder();
        for (ZoneSimulator zone : cafeteria.getZones()) {
            zonesStr.append(zone).append("  ");
        }
        synchronized (PRINT_LOCK) {
            System.out.printf("[%s] %s | red: %s | (intenzitet %d, zauzeto %d/%d)%n",
                    cafeteria.getCafeteriaId(),
                    LocalDateTime.now().format(TIME_FMT),
                    zonesStr.toString().trim(),
                    cafeteria.getLastIntensity(),
                    cafeteria.getOccupiedZoneCount(),
                    cafeteria.getZoneCount()
                );
        }
    }

    public void stop() {
        running = false;
        try {
            publisher.disconnect();
        } catch (MqttException ignored) {
        }
    }

    private void sleepQuiet(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            running = false;
        }
    }
}