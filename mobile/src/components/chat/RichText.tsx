import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { parseMarkdown, Span } from '../../ai/markdown';

/** The companion's reply, with bold, tappable links, bullets and pictures. */
export function RichText({ text, color, linkColor }: { text: string; color: string; linkColor: string }) {
  const lines = parseMarkdown(text);
  const spans = (list: Span[]) =>
    list.map((s, i) =>
      s.type === 'link' ? (
        <Text
          key={i}
          onPress={() => Linking.openURL(s.url).catch(() => {})}
          style={[styles.link, { color: linkColor }, s.bold && styles.bold]}
          suppressHighlighting={false}
        >
          {s.text}
        </Text>
      ) : (
        <Text key={i} style={s.bold && styles.bold}>
          {s.text}
        </Text>
      ),
    );
  return (
    <View style={styles.wrap}>
      {lines.map((line, i) => {
        if (line.type === 'image') {
          return <Image key={i} source={{ uri: line.url }} style={styles.image} resizeMode="cover" accessibilityLabel={line.alt} />;
        }
        if (line.type === 'bullet') {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.text, styles.marker, { color: linkColor }]}>{line.marker}</Text>
              <Text style={[styles.text, { color, flex: 1 }]} selectable>
                {spans(line.spans)}
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} style={[styles.text, { color }]} selectable>
            {spans(line.spans)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  text: { fontSize: 16, lineHeight: 22 },
  bold: { fontWeight: '700' },
  link: { fontWeight: '600', textDecorationLine: 'underline' },
  bulletRow: { flexDirection: 'row', gap: 8 },
  marker: { fontWeight: '700', minWidth: 12 },
  image: { width: '100%', aspectRatio: 1.4, borderRadius: 12, marginVertical: 2 },
});
