package org.redometar;

import java.time.LocalDateTime;

public class QueueSimulator {

    private static final int BASE = 15;
    private static final int PEAK_BONUS = 60; 
    private static final int MEDIUM_BONUS = 35; 

    private QueueSimulator() {}

    // vraca vrijednost 0-100 ovisno o dobu dana i danu u tjednu (0 = zatvoreno, 100 = pun red)
    public static int targetIntensity() {
        LocalDateTime now = LocalDateTime.now();
        int hour = now.getHour(); //za testiranje postaviti na npr. 12
        int dow  = now.getDayOfWeek().getValue(); //za testiranje postaviti na npr. 1

        // zatvoreno
        if (hour < 7 || hour >= 20) return 0;

        int intensity = BASE;

        if ((hour >= 7 && hour <= 8) || (hour >= 12 && hour <= 14) || (hour == 17 || hour == 18)) {
            intensity += PEAK_BONUS;
        } else if ((hour >= 9 && hour <= 11) || (hour >= 15 && hour <= 16) || hour == 19) {
            intensity += MEDIUM_BONUS;
        }


        switch (dow) {
            case 1: intensity = (int) (intensity * 1.20); break; // pon - povecan promet
            case 5: intensity = (int) (intensity * 0.90); break; // pet - malo manji
            case 6: intensity = (int) (intensity * 0.30); break; // sub
            case 7: intensity = (int) (intensity * 0.20); break; // ned
        }

        return Math.clamp(intensity, 0, 100);
    }
}
