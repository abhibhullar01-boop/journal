import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchPreview, LinkPreview, siteOf } from '../../ai/preview';
import { usePalette } from '../theme';

function LinkCard({ url, label, note }: { url: string; label: string; note: string }) {
  const p = usePalette();
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetchPreview(url).then((result) => live && setPreview(result));
    return () => {
      live = false;
    };
  }, [url]);

  const site = preview?.site ?? siteOf(url);
  // The companion's label is usually cleaner than a store's page title.
  const title = label && !/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(label) ? label : preview?.title ?? label;
  const showImage = !!preview?.image && !imageFailed;

  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={({ pressed }) => [styles.card, { backgroundColor: p.card, borderColor: p.border, shadowColor: p.shadow }, pressed && { opacity: 0.8 }]}
      accessibilityRole="link"
      accessibilityLabel={`${title}, on ${site}`}
    >
      <View style={[styles.imageBox, { backgroundColor: p.accentSoft }]}>
        {showImage ? (
          <Image source={{ uri: preview!.image! }} style={styles.image} resizeMode="contain" onError={() => setImageFailed(true)} />
        ) : (
          <View style={styles.placeholder}>
            <Image source={{ uri: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(siteOf(url))}&sz=128` }} style={styles.favicon} />
            {!preview ? <Text style={[styles.loading, { color: p.secondary }]}>Loading picture…</Text> : null}
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: p.text }]} numberOfLines={2}>
          {title}
        </Text>
        {preview?.price ? <Text style={[styles.price, { color: p.accent }]}>{preview.price}</Text> : null}
        {note ? (
          <Text style={[styles.note, { color: p.secondary }]} numberOfLines={2}>
            {note}
          </Text>
        ) : null}
        <View style={styles.siteRow}>
          <Text style={[styles.site, { color: p.secondary }]} numberOfLines={1}>
            {site}
          </Text>
          <Ionicons name="open-outline" size={13} color={p.secondary} />
        </View>
      </View>
    </Pressable>
  );
}

/** A swipeable row of picture cards for the links in a reply. */
export function LinkCards({ links }: { links: { url: string; label: string; note: string }[] }) {
  if (!links.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroller}>
      {links.slice(0, 8).map((l) => (
        <LinkCard key={l.url} url={l.url} label={l.label} note={l.note} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { marginTop: 8, marginRight: -32 },
  row: { gap: 10, paddingRight: 32, paddingBottom: 6 },
  card: {
    width: 190,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  imageBox: { height: 130, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  image: { width: '100%', height: '100%', backgroundColor: '#fff' },
  placeholder: { alignItems: 'center', gap: 8 },
  favicon: { width: 40, height: 40, borderRadius: 8 },
  loading: { fontSize: 12 },
  body: { padding: 10, gap: 3 },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  price: { fontSize: 14, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 16 },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  site: { fontSize: 12, flexShrink: 1 },
});
