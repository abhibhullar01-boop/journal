import { memo, useMemo } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { parseMarkdown, Span } from '../../ai/markdown';

/** The companion's reply, with bold, tappable links, bullets and pictures. */
export const RichText = memo(function RichText({
  text,
  color,
  linkColor,
  markerColor,
  selectable = true,
}: {
  text: string;
  color: string;
  linkColor: string;
  markerColor?: string;
  /** Off when the text sits in something that opens a menu on a long press. */
  selectable?: boolean;
}) {
  const lines = useMemo(() => parseMarkdown(text), [text]);
  const spans = (list: Span[]) =>
    list.map((s, i) =>
      s.type === 'link' ? (
        <Text
          key={i}
          onPress={() => Linking.openURL(s.url).catch(() => {})}
          style={[styles.link, { color: linkColor, textDecorationColor: linkColor }, s.bold && styles.bold]}
          suppressHighlighting={false}
          accessibilityRole="link"
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
              <Text style={[styles.text, styles.marker, { color: markerColor ?? color }]}>{line.marker}</Text>
              <Text style={[styles.text, { color, flex: 1 }]} selectable={selectable}>
                {spans(line.spans)}
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} style={[styles.text, { color }]} selectable={selectable}>
            {spans(line.spans)}
          </Text>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  text: { fontSize: 16, lineHeight: 24 },
  bold: { fontWeight: '600' },
  link: { fontWeight: '500', textDecorationLine: 'underline' },
  bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 2 },
  marker: { minWidth: 12 },
  image: { width: '100%', aspectRatio: 1.4, borderRadius: 12, marginVertical: 2 },
});
