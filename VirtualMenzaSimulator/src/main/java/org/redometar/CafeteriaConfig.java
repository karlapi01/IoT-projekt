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
        public int zoneCount() {
            return zoneThresholds.length;
        }
    }

    public static List<Cafeteria> getCafeterias() {
        List<Cafeteria> cafeterias = new ArrayList<>();

        // --- Studentski dom Cvjetno naselje ---
        cafeterias.add(new Cafeteria(
                "virtualna_menza_cvjetno_linija1",
                "Cvjetno naselje - Linija 1",
                new int[] { 30, 65 },
                System.getenv("MENZA_CVJETNO_LINIJA1_TOKEN")));

        cafeterias.add(new Cafeteria(
                "virtualna_menza_cvjetno_linija2",
                "Cvjetno naselje - Linija 2",
                new int[] { 30, 65 },
                System.getenv("MENZA_CVJETNO_LINIJA2_TOKEN")));

        // --- Sava ---
        cafeterias.add(new Cafeteria(
                "virtualna_menza_sava_restoran1",
                "Sava - Restoran 1",
                new int[] { 30, 65 },
                System.getenv("MENZA_SAVA_RESTORAN1_TOKEN")));

        cafeterias.add(new Cafeteria(
                "virtualna_menza_sava_restoran2",
                "Sava - Restoran 2",
                new int[] { 30, 65 },
                System.getenv("MENZA_SAVA_RESTORAN2_TOKEN")));

        // --- SC ---
        cafeterias.add(new Cafeteria(
                "virtualna_menza_sc_brza",
                "SC - Brza menza",
                new int[] { 20, 50, 80 },
                System.getenv("MENZA_SC_BRZA_TOKEN")));

        cafeterias.add(new Cafeteria(
                "virtualna_menza_sc_linija1",
                "SC - Linija 1",
                new int[] { 20, 50, 80 },
                System.getenv("MENZA_SC_LINIJA1_TOKEN")));

        cafeterias.add(new Cafeteria(
                "virtualna_menza_sc_linija2",
                "SC - Linija 2",
                new int[] { 20, 50, 80 },
                System.getenv("MENZA_SC_LINIJA2_TOKEN")));

        // --- FER ---
        cafeterias.add(new Cafeteria(
                "virtualna_menza_fer_spora",
                "FER - Spora menza",
                new int[] { 30, 65 },
                System.getenv("MENZA_FER_SPORA_TOKEN")));

        return cafeterias;
    }
}