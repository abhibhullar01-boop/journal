import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchPreview, LinkPreview, siteOf } from '../../ai/preview';
import { LIFT, RADIUS, TYPE, usePalette } from '../theme';

const favicon = (url: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(siteOf(url))}&sz=64`;

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

  const site = siteOf(url);
  // The companion's label is usually cleaner than a store's page title.
  const title = label && !/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(label) ? label : preview?.title ?? label;
  const showImage = !!preview?.image && !imageFailed;

  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={({ pressed }) => [styles.card, LIFT, { backgroundColor: p.card, borderColor: p.hairline }, pressed && { opacity: 0.85 }]}
      accessibilityRole="link"
      accessibilityLabel={`${title}, on ${site}`}
    >
      <View style={[styles.imageBox, { borderBottomColor: p.hairline }]}>
        {showImage ? (
          <Image source={{ uri: preview!.image! }} style={styles.image} resizeMode="contain" onError={() => setImageFailed(true)} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: p.sunken }]}>
            <Image source={{ uri: favicon(url) }} style={styles.bigFavicon} />
            {!preview ? <Text style={[TYPE.caption, { color: p.tertiary }]}>Loading picture…</Text> : null}
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[TYPE.subhead, { color: p.text, fontWeight: '600' }]} numberOfLines={2}>
          {title}
        </Text>
        {preview?.price ? <Text style={[TYPE.subhead, { color: p.accent, fontWeight: '700' }]}>{preview.price}</Text> : null}
        {note ? (
          <Text style={[TYPE.caption, { color: p.secondary }]} numberOfLines={2}>
            {note}
          </Text>
        ) : null}
        <View style={styles.siteRow}>
          <Image source={{ uri: favicon(url) }} style={styles.favicon} />
          <Text style={[TYPE.caption, { color: p.tertiary, flexShrink: 1 }]} numberOfLines={1}>
            {site}
          </Text>
          <Ionicons name="open-outline" size={12} color={p.tertiary} />
        </View>
      </View>
    </Pressable>
  );
}

/** A swipeable row of picture cards for the links in a reply. */
export const LinkCards = memo(function LinkCards({ links }: { links: { url: string; label: string; note: string }[] }) {
  if (!links.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroller}>
      {links.slice(0, 8).map((l) => (
        <LinkCard key={l.url} url={l.url} label={l.label} note={l.note} />
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroller: { marginTop: 10, marginHorizontal: -16 },
  row: { gap: 10, paddingHorizontal: 16, paddingBottom: 8, paddingTop: 2 },
  card: { width: 196, borderRadius: RADIUS.l, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  imageBox: { height: 124, backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  bigFavicon: { width: 32, height: 32, borderRadius: 7 },
  body: { padding: 11, gap: 3 },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  favicon: { width: 13, height: 13, borderRadius: 3 },
});
