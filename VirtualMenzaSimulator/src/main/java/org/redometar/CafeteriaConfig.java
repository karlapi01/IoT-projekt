package org.redometar;

import java.util.ArrayList;
import java.util.List;

/*
Svaka menza je zaseban Device u ThingsBoardu i dobiva vlastiti thread, vlastitu MQTT konekciju i vlastiti token
zoneThresholds definira na kojoj razini intenziteta (0-100) se aktivira
svaka zona — odgovara fizickoj udaljenosti senzora od blagajne:
nizi prag  = senzor blize blagajni (aktivira se cim postoji kratak red)
visi prag  = senzor dalje od blagajne (aktivira se tek kad je red dugacak)
*/
public class CafeteriaConfig {

    public record Cafeteria(String id, String name, int[] zoneThresholds, String token) {
        // broj zona = broj konfiguriranih pragova
        public int zoneCount() { return zoneThresholds.length; }
    }

    public static List<Cafeteria> getCafeterias() {
        List<Cafeteria> cafeterias = new ArrayList<>();

        // zona1: senzor blizu blagajne - aktivira se pri 30% popunjenosti reda
        // zona2: senzor cca. 3 m dalje - aktivira se pri 65% popunjenosti reda
        cafeterias.add(new Cafeteria(
                "virtualna_menza1",
                "Studentski dom Stjepan Radic",
                new int[]{30, 65},
                System.getenv("MENZA1_TOKEN")
        ));

        cafeterias.add(new Cafeteria(
                "virtualna_menza2",
                "SC menza",
                new int[]{20, 50, 80},
                System.getenv("MENZA2_TOKEN")
        ));

        cafeterias.add(new Cafeteria(
                "virtualna_menza3",
                "Studentski dom Cvjetno naselje",
                new int[]{30, 65},
                System.getenv("MENZA3_TOKEN")
        ));

        return cafeterias;
    }
}
