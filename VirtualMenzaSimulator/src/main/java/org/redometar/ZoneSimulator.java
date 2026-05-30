package org.redometar;

/*
Simulira jedan senzor (zonu) u redu 
threshold odgovara fizičkoj poziciji senzora: kad intenzitet menze prijede taj prag, zona detektira prisutnost
Potvrda od 5 sekundi -  kratkotrajni prolaznici ne okidaju promjenu stanja
*/
public class ZoneSimulator {

    private final int zoneNumber;
    private final int threshold;       // intenzitet pri kojem ova zona reagira

    private boolean currentReading;   // trenutno ocitanje 
    private boolean occupied;         // potvrdeno stanje, salje se na ThingsBoard
    private long presentSince;

    private static final long PRESENCE_REQUIRED_MS = 5000; // kao esp32

    public ZoneSimulator(int zoneNumber, int threshold) {
        this.zoneNumber = zoneNumber;
        this.threshold  = threshold;
    }

    // jedno ocitanje, usporeduje intenzitet s pragom zone
    public void update(int intensity) {
        currentReading = intensity > threshold;

        if (currentReading) {
            if (presentSince == 0) {
                presentSince = System.currentTimeMillis();
            }
            if (System.currentTimeMillis() - presentSince >= PRESENCE_REQUIRED_MS) {
                occupied = true;
            }
        } else {
            occupied     = false;
            presentSince = 0;
        }
    }

    public int getZoneNumber() { return zoneNumber; }
    public int getThreshold()  { return threshold; }
    public boolean isOccupied() { return occupied; }
    public boolean getCurrentReading() { return currentReading; }

    @Override
    public String toString() {
        String s = occupied ? "zauzeta" : (currentReading ? "provjera" : "slobodna");
        return String.format("zona%d(>%d)=%s", zoneNumber, threshold, s);
    }
}
