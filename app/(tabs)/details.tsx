import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function Details() {
  const { id } = useLocalSearchParams();
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Refetch when ID changes
  useEffect(() => {
    if (id) {
      fetchGame();
    }
  }, [id]);

  async function fetchGame() {
    try {
      setLoading(true);
      const res = await fetch(
        `https://www.freetogame.com/api/game?id=${id}`
      );
      const data = await res.json();
      setGame(data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f5c518" />
        <Text style={{ color: "#aaa", marginTop: 10 }}>
          Loading game details...
        </Text>
      </View>
    );
  }

  if (!game) return null;

  return (
    <ScrollView style={styles.container}>
      {/* HERO IMAGE */}
      <Image source={{ uri: game.thumbnail }} style={styles.banner} />

      {/* TITLE */}
      <Text style={styles.title}>{game.title}</Text>
      <Text style={styles.meta}>
        {game.genre} • {game.platform}
      </Text>

      {/* CTA */}
      <Pressable
        style={styles.playButton}
        onPress={() => Linking.openURL(game.game_url)}
      >
        <Text style={styles.playText}>Play / Download</Text>
      </Pressable>

      {/* ABOUT */}
      <Section title="About the Game">
        <Text style={styles.desc}>{game.description}</Text>
      </Section>

      {/* GAME INFO */}
      <Section title="Game Information">
        <Info label="Developer" value={game.developer} />
        <Info label="Publisher" value={game.publisher} />
        <Info label="Release Date" value={game.release_date} />
        <Info label="Status" value={game.status} />
      </Section>

      {/* SYSTEM REQUIREMENTS */}
      {game.minimum_system_requirements && (
        <Section title="Minimum System Requirements">
          <Info label="OS" value={game.minimum_system_requirements.os} />
          <Info label="Processor" value={game.minimum_system_requirements.processor} />
          <Info label="Memory" value={game.minimum_system_requirements.memory} />
          <Info label="Graphics" value={game.minimum_system_requirements.graphics} />
          <Info label="Storage" value={game.minimum_system_requirements.storage} />
        </Section>
      )}
    </ScrollView>
  );
}

/* -------- Components -------- */

function Section({ title, children }: any) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Info({ label, value }: any) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/* -------- Styles -------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 12,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },

  banner: {
    width: "100%",
    height: 220,
    borderRadius: 12,
  },

  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 12,
  },

  meta: {
    color: "#f5c518",
    fontSize: 13,
    marginTop: 4,
  },

  playButton: {
    marginTop: 14,
    backgroundColor: "#f5c518",
    paddingVertical: 12,
    borderRadius: 10,
  },

  playText: {
    textAlign: "center",
    fontWeight: "bold",
    color: "#000",
    fontSize: 15,
  },

  section: {
    marginTop: 22,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },

  desc: {
    color: "#ccc",
    fontSize: 14,
    lineHeight: 22,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  infoLabel: {
    color: "#aaa",
    fontSize: 13,
  },

  infoValue: {
    color: "#fff",
    fontSize: 13,
    flex: 1,
    textAlign: "right",
    marginLeft: 10,
  },
});
