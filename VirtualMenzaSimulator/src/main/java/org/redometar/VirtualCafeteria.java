package org.redometar;

import java.util.ArrayList;
import java.util.List;

/*
Simulira jednu menzu s vise zona
Svaka zona ima konfigurirani prag koji odgovara fizickoj poziciji senzora
uz red — identicno postavljenom ESP32 uredaju s ultrasonicnim senzorom
*/

public class VirtualCafeteria {

    private final String cafeteriaId;
    private final String cafeteriaName;
    private final List<ZoneSimulator> zones;

    private double smoothedIntensity = QueueSimulator.targetIntensity();
    private static final double ALPHA = 0.03;
    private static final double NOISE_AMPLITUDE = 2.0;

    private int lastIntensity;

    public VirtualCafeteria(String cafeteriaId, String cafeteriaName, int[] zoneThresholds) {
        this.cafeteriaId   = cafeteriaId;
        this.cafeteriaName = cafeteriaName;
        this.zones = new ArrayList<>();
        for (int i = 0; i < zoneThresholds.length; i++) {
            zones.add(new ZoneSimulator(i + 1, zoneThresholds[i]));
        }
    }

    // Jedno ocitanje svih zona (poziva se svaka 500 ms kao esp32 petlja)
    public void update() {
        double target = QueueSimulator.targetIntensity();

        smoothedIntensity = smoothedIntensity * (1.0 - ALPHA) + target * ALPHA;
        if (target > 0) {
            smoothedIntensity += (Math.random() - 0.5) * 2.0 * NOISE_AMPLITUDE;
        }

        smoothedIntensity = Math.clamp(smoothedIntensity, 0.0, 100.0);
        lastIntensity = (int) smoothedIntensity;

        for (ZoneSimulator zone : zones) {
            zone.update(lastIntensity);
        }
    }

    public String getCafeteriaId()   { return cafeteriaId; }
    public String getCafeteriaName() { return cafeteriaName; }
    public List<ZoneSimulator> getZones() { return zones; }
    public int getZoneCount()        { return zones.size(); }

    public int getLastIntensity() { return lastIntensity; }

    public int getOccupiedZoneCount() {
        return (int) zones.stream().filter(ZoneSimulator::isOccupied).count();
    }
}
