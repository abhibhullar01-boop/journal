import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RADIUS, SPACE, TYPE, usePalette } from './theme';
import { useWide } from './layout';

/**
 * Alerts, option sheets and text prompts. A phone uses its own (Alert, the iOS action sheet);
 * a browser has none that look right (React Native's Alert does nothing on the web), so the
 * website draws them itself with <DialogHost />.
 */
export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface SheetOption {
  text: string;
  destructive?: boolean;
  onPress: () => void;
}

type Request =
  | { kind: 'alert'; title: string; message?: string; buttons: DialogButton[] }
  | { kind: 'sheet'; title: string; message?: string; options: SheetOption[] }
  | { kind: 'prompt'; title: string; message?: string; initial: string; resolve(value: string | null): void };

type Listener = (request: Request) => void;
let listener: Listener | null = null;
const waiting: Request[] = [];
let toastListener: ((message: string) => void) | null = null;

function present(request: Request) {
  if (listener) listener(request);
  else waiting.push(request);
}

/** A message with buttons. With no buttons it just has OK. */
export function alert(title: string, message?: string, buttons?: DialogButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  present({ kind: 'alert', title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
}

/** A list of choices: the native action sheet on iPhone, a dialog on Android, a sheet on the web. */
export function showSheet(title: string, message: string | undefined, options: SheetOption[]): void {
  if (Platform.OS === 'ios') {
    const destructive = options.findIndex((o) => o.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: [...options.map((o) => o.text), 'Cancel'],
        cancelButtonIndex: options.length,
        destructiveButtonIndex: destructive >= 0 ? destructive : undefined,
      },
      (index) => index < options.length && options[index].onPress(),
    );
  } else if (Platform.OS === 'web') {
    present({ kind: 'sheet', title, message, options });
  } else {
    Alert.alert(title, message, [
      ...options.map((o) => ({ text: o.text, style: o.destructive ? ('destructive' as const) : undefined, onPress: o.onPress })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
}

/** Asks for a line of text. Resolves to null when cancelled. */
export function askText(title: string, message?: string, initial = ''): Promise<string | null> {
  if (Platform.OS === 'ios') {
    return new Promise((resolve) =>
      Alert.prompt(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
          { text: 'Save', onPress: (value?: string) => resolve(value ?? '') },
        ],
        'plain-text',
        initial,
      ),
    );
  }
  if (Platform.OS === 'web') return new Promise((resolve) => present({ kind: 'prompt', title, message, initial, resolve }));
  // Android has no prompt; the app isn't built for it, but don't hang.
  return Promise.resolve(null);
}

/** A short note at the bottom of the page ("Copied"). Web only; phones show nothing. */
export function toast(message: string): void {
  toastListener?.(message);
}

/** Draws the web's dialogs and toasts. Renders nothing on a phone. */
export function DialogHost() {
  if (Platform.OS !== 'web') return null;
  return <WebDialogs />;
}

function WebDialogs() {
  const p = usePalette();
  const wide = useWide();
  const [queue, setQueue] = useState<Request[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const current = queue[0] ?? null;
  const currentRef = useRef(current);
  currentRef.current = current;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    listener = (request) => setQueue((q) => [...q, request]);
    if (waiting.length) setQueue((q) => [...q, ...waiting.splice(0)]);
    toastListener = setNote;
    return () => {
      listener = null;
      toastListener = null;
    };
  }, []);

  useEffect(() => {
    if (current?.kind === 'prompt') setValue(current.initial);
  }, [current]);

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 2200);
    return () => clearTimeout(timer);
  }, [note]);

  /** Closes the dialog first, so a choice that opens another dialog shows it next. */
  const close = (then?: () => void) => {
    setQueue((q) => q.slice(1));
    if (then) setTimeout(then, 0);
  };

  const cancel = () => {
    const c = currentRef.current;
    if (!c) return;
    if (c.kind === 'prompt') close(() => c.resolve(null));
    else if (c.kind === 'alert') close(c.buttons.find((b) => b.style === 'cancel')?.onPress);
    else close();
  };

  const confirmPrompt = () => {
    const c = currentRef.current;
    if (c?.kind === 'prompt') close(() => c.resolve(valueRef.current));
  };

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        const c = currentRef.current;
        if (c?.kind === 'prompt') {
          e.preventDefault();
          confirmPrompt();
        } else if (c?.kind === 'alert' && c.buttons.length === 1) {
          e.preventDefault();
          close(c.buttons[0].onPress);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [current]);

  const toastView = note ? (
    <View pointerEvents="none" style={styles.toastWrap}>
      <View style={[styles.toast, { backgroundColor: p.text }]}>
        <Text style={[TYPE.subhead, { color: p.card, fontWeight: '600' }]}>{note}</Text>
      </View>
    </View>
  ) : null;

  if (!current) return toastView;

  const sheet = current.kind === 'sheet' && !wide;
  return (
    <>
      <View style={[styles.overlay, sheet ? styles.overlaySheet : styles.overlayCenter]}>
        <Pressable style={[StyleSheet.absoluteFill, styles.scrim]} onPress={cancel} accessibilityLabel="Close" />
        <View
          role="dialog"
          aria-modal
          aria-label={current.title}
          style={[styles.card, sheet ? styles.sheetCard : styles.centerCard, { backgroundColor: p.card }]}
        >
          <View style={styles.head}>
            <Text style={[TYPE.headline, { color: p.text, textAlign: sheet ? 'center' : 'left' }]}>{current.title}</Text>
            {current.message ? (
              <Text style={[TYPE.footnote, { color: p.secondary, marginTop: 4, textAlign: sheet ? 'center' : 'left' }]}>{current.message}</Text>
            ) : null}
          </View>

          {current.kind === 'prompt' ? (
            <>
              <TextInput
                value={value}
                onChangeText={setValue}
                autoFocus
                selectTextOnFocus
                onSubmitEditing={confirmPrompt}
                style={[TYPE.body, styles.input, { color: p.text, backgroundColor: p.sunken, borderColor: p.border }]}
              />
              <View style={styles.buttonRow}>
                <DialogButtonView text="Cancel" onPress={cancel} />
                <DialogButtonView text="Save" primary onPress={confirmPrompt} />
              </View>
            </>
          ) : current.kind === 'alert' ? (
            <View style={current.buttons.length > 2 ? styles.buttonColumn : styles.buttonRow}>
              {current.buttons.map((b, k) => (
                <DialogButtonView
                  key={`${b.text}-${k}`}
                  text={b.text}
                  destructive={b.style === 'destructive'}
                  primary={b.style !== 'cancel' && b.style !== 'destructive' && k === current.buttons.length - 1}
                  onPress={() => close(b.onPress)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.options}>
              {current.options.map((o, k) => (
                <Pressable
                  key={`${o.text}-${k}`}
                  onPress={() => close(o.onPress)}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.option,
                    { borderTopColor: p.hairline },
                    (pressed || hovered) && { backgroundColor: p.sunken },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={[TYPE.body, { color: o.destructive ? p.danger : p.text, textAlign: sheet ? 'center' : 'left' }]}>{o.text}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={cancel}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.option,
                  styles.cancelOption,
                  { borderTopColor: p.border },
                  (pressed || hovered) && { backgroundColor: p.sunken },
                ]}
                accessibilityRole="button"
              >
                <Text style={[TYPE.body, { color: p.secondary, fontWeight: '600', textAlign: sheet ? 'center' : 'left' }]}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
      {toastView}
    </>
  );
}

function DialogButtonView({ text, onPress, primary, destructive }: { text: string; onPress(): void; primary?: boolean; destructive?: boolean }) {
  const p = usePalette();
  const bg = destructive ? p.danger : primary ? p.accent : p.card;
  const fg = destructive || primary ? '#FFFFFF' : p.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.button,
        { backgroundColor: bg, borderColor: destructive ? p.danger : primary ? p.accent : p.border },
        (pressed || hovered) && { opacity: 0.85 },
      ]}
    >
      <Text style={[TYPE.subhead, { color: fg, fontWeight: '600' }]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  overlayCenter: { alignItems: 'center', justifyContent: 'center', padding: SPACE.xl },
  overlaySheet: { justifyContent: 'flex-end' },
  scrim: { backgroundColor: 'rgba(28, 27, 24, 0.38)' },
  card: { overflow: 'hidden', shadowColor: '#2A2217', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  centerCard: { width: '100%', maxWidth: 420, borderRadius: RADIUS.l },
  sheetCard: { width: '100%', borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingBottom: SPACE.s },
  head: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.xl, paddingBottom: SPACE.m },
  input: { marginHorizontal: SPACE.xl, borderRadius: RADIUS.s + 2, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10 },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACE.s, padding: SPACE.l, paddingTop: SPACE.m },
  buttonColumn: { gap: SPACE.s, padding: SPACE.l, paddingTop: SPACE.s },
  button: { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  options: { paddingBottom: 0 },
  option: { paddingHorizontal: SPACE.xl, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  cancelOption: { borderTopWidth: 1 },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 96, alignItems: 'center', zIndex: 1001 },
  toast: { borderRadius: RADIUS.pill, paddingHorizontal: 18, paddingVertical: 10, opacity: 0.94 },
});
