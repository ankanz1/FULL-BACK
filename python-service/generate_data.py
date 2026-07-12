import os
import csv
import random

def generate_player_stats():
    # List of top players across positions with base traits to generate realistic stats
    players_raw = [
        # --- ATTACKERS (High goals/assists, low tackles/interceptions) ---
        ("Erling Haaland", "Norway", "Attacker", 180, 2800, 32, 5, 12, 4, 2, 78.5),
        ("Kylian Mbappé", "France", "Attacker", 180, 2600, 27, 8, 38, 8, 4, 82.1),
        ("Harry Kane", "England", "Attacker", 110, 2900, 25, 10, 35, 10, 5, 80.4),
        ("Mohamed Salah", "Egypt", "Attacker", 110, 2700, 22, 11, 48, 12, 6, 79.8),
        ("Vinicius Junior", "Brazil", "Attacker", 150, 2500, 18, 9, 45, 15, 8, 81.5),
        ("Bukayo Saka", "England", "Attacker", 130, 2800, 16, 12, 55, 22, 14, 83.2),
        ("Lamine Yamal", "Spain", "Attacker", 120, 2400, 10, 14, 52, 18, 10, 84.1),
        ("Lautaro Martínez", "Argentina", "Attacker", 110, 2500, 21, 4, 22, 14, 7, 75.3),
        ("Robert Lewandowski", "Poland", "Attacker", 15, 2600, 20, 5, 20, 6, 3, 77.2),
        ("Antoine Griezmann", "France", "Attacker", 25, 2800, 12, 8, 62, 35, 20, 83.9),
        ("Son Heung-min", "South Korea", "Attacker", 45, 2600, 14, 6, 40, 15, 8, 80.6),
        ("Rafael Leão", "Portugal", "Attacker", 75, 2300, 11, 8, 30, 10, 5, 78.9),
        ("Phil Foden", "England", "Attacker", 150, 2500, 16, 10, 50, 18, 11, 86.4),
        ("Jamal Musiala", "Germany", "Attacker", 130, 2400, 12, 9, 48, 25, 15, 85.2),
        ("Florian Wirtz", "Germany", "Attacker", 130, 2600, 14, 15, 68, 20, 12, 86.8),
        ("Cole Palmer", "England", "Attacker", 90, 2500, 20, 12, 58, 18, 10, 83.5),
        ("Victor Osimhen", "Nigeria", "Attacker", 100, 2100, 15, 3, 15, 8, 4, 72.8),
        ("Neymar Jr", "Brazil", "Attacker", 30, 1200, 8, 6, 28, 6, 3, 82.5),
        ("Lionel Messi", "Argentina", "Attacker", 30, 2000, 15, 12, 60, 5, 2, 85.9),
        ("Cristiano Ronaldo", "Portugal", "Attacker", 15, 2200, 18, 4, 18, 4, 1, 78.2),

        # --- MIDFIELDERS (High key passes/pass accuracy, moderate tackles) ---
        ("Kevin De Bruyne", "Belgium", "Midfielder", 50, 2200, 6, 16, 85, 24, 12, 87.5),
        ("Jude Bellingham", "England", "Midfielder", 180, 2700, 17, 8, 42, 45, 32, 86.9),
        ("Rodri", "Spain", "Midfielder", 130, 3000, 8, 7, 35, 65, 48, 92.5),
        ("Declan Rice", "England", "Midfielder", 120, 2900, 7, 8, 30, 70, 52, 89.2),
        ("Martin Ødegaard", "Norway", "Midfielder", 110, 2800, 9, 10, 82, 30, 18, 86.3),
        ("Bruno Fernandes", "Portugal", "Midfielder", 70, 3000, 10, 12, 95, 40, 22, 79.9),
        ("Federico Valverde", "Uruguay", "Midfielder", 120, 2900, 7, 6, 38, 55, 36, 88.4),
        ("Aurelien Tchouameni", "France", "Midfielder", 100, 2500, 3, 2, 18, 58, 46, 91.2),
        ("Eduardo Camavinga", "France", "Midfielder", 100, 2300, 2, 4, 25, 62, 38, 89.9),
        ("Granit Xhaka", "Switzerland", "Midfielder", 20, 2800, 4, 6, 45, 42, 30, 90.5),
        ("Alexis Mac Allister", "Argentina", "Midfielder", 75, 2600, 6, 7, 40, 58, 35, 87.9),
        ("Dominik Szoboszlai", "Hungary", "Midfielder", 75, 2500, 7, 6, 48, 32, 20, 83.4),
        ("Ilkay Gündogan", "Germany", "Midfielder", 15, 2600, 6, 8, 52, 30, 18, 88.6),
        ("Frenkie de Jong", "Netherlands", "Midfielder", 70, 2100, 2, 4, 28, 38, 25, 91.8),
        ("Pedri", "Spain", "Midfielder", 80, 2000, 4, 6, 42, 35, 22, 90.1),
        ("Gavi", "Spain", "Midfielder", 90, 1800, 3, 3, 20, 52, 28, 87.3),
        ("Vitinha", "Portugal", "Midfielder", 55, 2500, 5, 5, 36, 40, 28, 91.5),
        ("Hakan Çalhanoglu", "Turkey", "Midfielder", 45, 2700, 11, 4, 55, 38, 26, 89.7),
        ("Nicolo Barella", "Italy", "Midfielder", 80, 2600, 4, 7, 42, 48, 30, 85.8),
        ("Toni Kroos", "Germany", "Midfielder", 10, 2200, 1, 8, 75, 22, 18, 93.8),

        # --- DEFENDERS (High tackles/interceptions, high pass accuracy, low goals) ---
        ("Virgil van Dijk", "Netherlands", "Defender", 30, 2800, 2, 2, 8, 48, 42, 90.2),
        ("Rúben Dias", "Portugal", "Defender", 80, 2700, 1, 1, 5, 52, 38, 91.9),
        ("William Saliba", "France", "Defender", 80, 2900, 2, 1, 6, 50, 40, 92.3),
        ("Gabriel Magalhães", "Brazil", "Defender", 70, 2800, 4, 1, 4, 48, 35, 88.9),
        ("John Stones", "England", "Defender", 38, 2000, 1, 2, 12, 36, 28, 93.1),
        ("Alessandro Bastoni", "Italy", "Defender", 70, 2600, 1, 4, 20, 42, 36, 89.5),
        ("Ronald Araujo", "Uruguay", "Defender", 70, 2200, 1, 1, 4, 55, 42, 86.4),
        ("Josko Gvardiol", "Croatia", "Defender", 75, 2600, 4, 3, 18, 45, 38, 88.7),
        ("Antonio Rüdiger", "Germany", "Defender", 25, 2800, 2, 1, 8, 52, 44, 89.9),
        ("Trent Alexander-Arnold", "England", "Defender", 70, 2500, 3, 9, 72, 32, 24, 80.1),
        ("Achraf Hakimi", "Morocco", "Defender", 65, 2600, 4, 6, 35, 46, 32, 84.6),
        ("Alphonso Davies", "Canada", "Defender", 50, 2400, 2, 5, 28, 40, 25, 85.3),
        ("Theo Hernandez", "Italy", "Defender", 60, 2600, 5, 4, 32, 45, 28, 83.8),
        ("Kyle Walker", "England", "Defender", 15, 2500, 0, 2, 15, 38, 30, 88.2),
        ("Carvajal", "Spain", "Defender", 12, 2600, 2, 4, 22, 50, 38, 85.5),
        ("Jules Koundé", "France", "Defender", 50, 2700, 1, 3, 18, 48, 35, 89.1),
        ("Ben White", "England", "Defender", 55, 2800, 2, 4, 25, 52, 32, 86.7),
        ("Jeremie Frimpong", "Netherlands", "Defender", 50, 2400, 9, 8, 40, 30, 18, 82.9),
        ("Alejandro Grimaldo", "Spain", "Defender", 45, 2800, 10, 13, 65, 35, 22, 84.8),
        ("Piero Hincapié", "Ecuador", "Defender", 40, 2400, 1, 2, 10, 48, 38, 87.2)
    ]

    # Expand the player list to 250+ by duplicating with slight variations
    nationalities = ["Argentina", "Brazil", "France", "Germany", "Spain", "England", "Italy", "Netherlands", "Portugal", "Belgium"]
    first_names = ["Lucas", "Mateo", "Enzo", "Hugo", "Leo", "Marc", "Julian", "Thomas", "Arthur", "David", "Sandro", "Daniel", "Oliver", "Alex", "Diego", "Robin", "Klaus", "Felipe", "Bruno", "Gabriel"]
    last_names = ["Silva", "Mendes", "Garcia", "Schmidt", "Dubois", "Martin", "Smith", "Jones", "Jansen", "De Jong", "Kovac", "Rossi", "Bianchi", "Gomez", "Fernandez", "Alves", "Santos", "Lopes", "Webber", "Müller"]

    random.seed(42) # For reproducibility
    players = []
    
    # Add real players first
    player_id_counter = 1
    for name, nat, pos, val, mins, goals, assists, kp, tkl, intc, acc in players_raw:
        players.append({
            "player_id": f"PL{player_id_counter:03d}",
            "name": name,
            "nationality": nat,
            "position": pos,
            "market_value_m": val,
            "minutes_played": mins,
            "goals": goals,
            "assists": assists,
            "key_passes": kp,
            "tackles": tkl,
            "interceptions": intc,
            "pass_accuracy": acc
        })
        player_id_counter += 1

    # Fill up to 260 players with synthetic data based on templates
    while len(players) < 265:
        # Choose a template player to clone
        base_player = random.choice(players_raw)
        name_gen = f"{random.choice(first_names)} {random.choice(last_names)}"
        
        # Prevent duplicate names
        if any(p["name"] == name_gen for p in players):
            continue
            
        pos = base_player[2]
        # Introduce variation (+/- 20%)
        var = lambda val: max(0.0, round(val * random.uniform(0.8, 1.2), 1))
        var_int = lambda val: max(0, int(val * random.uniform(0.7, 1.3)))
        
        val_gen = var(base_player[3])
        mins_gen = var_int(base_player[4])
        goals_gen = var_int(base_player[5])
        assists_gen = var_int(base_player[6])
        kp_gen = var_int(base_player[7])
        tkl_gen = var_int(base_player[8])
        intc_gen = var_int(base_player[9])
        acc_gen = min(100.0, var(base_player[10]))

        players.append({
            "player_id": f"PL{player_id_counter:03d}",
            "name": name_gen,
            "nationality": random.choice(nationalities),
            "position": pos,
            "market_value_m": val_gen,
            "minutes_played": mins_gen,
            "goals": goals_gen,
            "assists": assists_gen,
            "key_passes": kp_gen,
            "tackles": tkl_gen,
            "interceptions": intc_gen,
            "pass_accuracy": acc_gen
        })
        player_id_counter += 1

    # Save to CSV
    os.makedirs("data", exist_ok=True)
    csv_file = "data/players_stats.csv"
    with open(csv_file, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=players[0].keys())
        writer.writeheader()
        writer.writerows(players)
        
    print(f"Generated {len(players)} player records in {csv_file}")

if __name__ == "__main__":
    generate_player_stats()
