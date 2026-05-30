package org.redometar;
import java.util.ArrayList;
import java.util.List;
import org.eclipse.paho.client.mqttv3.MqttException;

public class Main {

    // Mosquitto "tcp://localhost:1883", ThingsBoard "tcp://161.53.133.253:1883"
    private static final String BROKER_URL = "tcp://161.53.133.253:1883";

    // interval slanja
    private static final int INTERVAL_SECONDS = 2;

    static void main() {
        System.out.println("Redometar virtual cafeteria simulator started");
        System.out.println("Broker: " + BROKER_URL);

        List<CafeteriaWorker> workers = new ArrayList<>();
        List<Thread> threads = new ArrayList<>();

        // za svaku menzu se kreira worker (otvara konekciju) i njegov thread
        for (CafeteriaConfig.Cafeteria cfg : CafeteriaConfig.getCafeterias()) {
            try {
                CafeteriaWorker worker = new CafeteriaWorker(cfg, BROKER_URL, INTERVAL_SECONDS);
                Thread thread = new Thread(worker, cfg.name());
                workers.add(worker);
                threads.add(thread);
                System.out.println("Cafeteria connected: " + cfg.name() + " (" + cfg.zoneCount() + " zona)");
            } catch (MqttException e) {
                System.err.println("Cafeteria connection error" + cfg.name() + "': " + e.getMessage());
            }
        }

        if (workers.isEmpty()) {
            System.err.println("\nUnable to connect virtual cafeterias" + "Check broker connection: " + BROKER_URL);
            return;
        }

        // Ctrl + C shutdown cleanup
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("\nTerminated...closing connections");
            for (CafeteriaWorker w : workers) {
                w.stop();
            }
        }));

        // pokreni sve threadove
        System.out.println("\nStarting " + threads.size() + " thread(s). " + "Press Ctrl+C to terminate\n");
        for (Thread t : threads) {
            t.start();
        }

        // glavni thread
        for (Thread t : threads) {
            try {
                t.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
