import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SAMPLE_MARKDOWN } from "../core/ui/sample";
import { parseMarkdown } from "../core/parsers/markdown";

type ProbeResult =
  | {
      ok: true;
      blockCount: number;
      wordCount: number;
      firstTwelve: { id: string; text: string }[];
    }
  | {
      ok: false;
      message: string;
      stack: string;
    };

export default function Index() {
  const probe = useMemo<ProbeResult>(() => {
    try {
      const doc = parseMarkdown(SAMPLE_MARKDOWN);
      const words = doc.blocks.flatMap((block) => block.words);
      const firstTwelve = words.slice(0, 12).map((w) => ({ id: w.id, text: w.text }));
      console.log("[hermes-probe]", "blocks:", doc.blocks.length, "words:", words.length);
      return { ok: true, blockCount: doc.blocks.length, wordCount: words.length, firstTwelve };
    } catch (e) {
      const err = e as Error;
      return {
        ok: false,
        message: String(err?.message ?? e),
        stack: String(err?.stack ?? "(no stack)"),
      };
    }
  }, []);

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Hermes core probe</Text>
        {probe.ok ? (
          <>
            <Text style={styles.line}>blocks: {probe.blockCount}</Text>
            <Text style={styles.line}>words: {probe.wordCount}</Text>
            <Text style={styles.subtitle}>first 12 words (id: text)</Text>
            {probe.firstTwelve.map((w) => (
              <Text style={styles.line} key={w.id}>
                {w.id}: {w.text}
              </Text>
            ))}
          </>
        ) : (
          <>
            <Text style={styles.error}>parseMarkdown threw:</Text>
            <Text style={styles.error}>{probe.message}</Text>
            <Text style={styles.stack}>{probe.stack}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingTop: 48,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 4,
  },
  line: {
    fontSize: 14,
    marginBottom: 2,
  },
  error: {
    fontSize: 14,
    color: "red",
    marginBottom: 4,
  },
  stack: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "red",
  },
});
