import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { AnchorSlotKind, SignalFeedbackRecord, SignalFeedbackValue } from "../types";
import { colors, spacing } from "../theme";

export type InterruptOverlayProps = {
  message: string;
  visible: boolean;
  signalKind: AnchorSlotKind | null;
  /** Signals already delivered today (local) — softens haptics after several hits. */
  priorDeliveriesToday: number;
  /** When set, overlay may collect post-open feedback (not on the OS notification). */
  interruptDeliveryId: string | null;
  interruptFeedback: SignalFeedbackRecord | undefined;
  onSubmitInterruptFeedback: (value: SignalFeedbackValue) => Promise<void>;
  onDismiss: () => void;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function softenImpact(style: Haptics.ImpactFeedbackStyle): Haptics.ImpactFeedbackStyle {
  switch (style) {
    case Haptics.ImpactFeedbackStyle.Heavy:
      return Haptics.ImpactFeedbackStyle.Medium;
    case Haptics.ImpactFeedbackStyle.Medium:
      return Haptics.ImpactFeedbackStyle.Light;
    default:
      return style;
  }
}

async function runSignalHaptics(kind: AnchorSlotKind | null, soften: boolean) {
  const s = (style: Haptics.ImpactFeedbackStyle) => (soften ? softenImpact(style) : style);
  try {
    switch (kind) {
      case "morning":
        await Haptics.impactAsync(s(Haptics.ImpactFeedbackStyle.Medium));
        await delay(90);
        await Haptics.impactAsync(s(Haptics.ImpactFeedbackStyle.Medium));
        break;
      case "evening":
        await Haptics.impactAsync(s(Haptics.ImpactFeedbackStyle.Heavy));
        await delay(220);
        await Haptics.impactAsync(s(Haptics.ImpactFeedbackStyle.Heavy));
        break;
      case "sunday":
        await Haptics.selectionAsync();
        await delay(60);
        await Haptics.impactAsync(s(Haptics.ImpactFeedbackStyle.Heavy));
        await delay(80);
        await Haptics.impactAsync(s(Haptics.ImpactFeedbackStyle.Heavy));
        break;
      case "lateNight":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        await delay(70);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        break;
      default:
        await Haptics.impactAsync(s(Haptics.ImpactFeedbackStyle.Heavy));
        await delay(40);
        await Haptics.impactAsync(s(Haptics.ImpactFeedbackStyle.Heavy));
    }
  } catch {
    /* haptics unavailable */
  }
}

export function InterruptOverlay({
  message,
  visible,
  signalKind,
  priorDeliveriesToday,
  interruptDeliveryId,
  interruptFeedback,
  onSubmitInterruptFeedback,
  onDismiss,
}: InterruptOverlayProps) {
  const [showMessage, setShowMessage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dismissed = useRef(false);
  const soften = priorDeliveriesToday >= 3 && signalKind !== "lateNight";

  const showFeedbackRow =
    Boolean(interruptDeliveryId) && showMessage && interruptFeedback === undefined;
  /** Longer while the question is visible — notification → read line → notice prompt. */
  const dismissMs = showFeedbackRow ? 20_000 : 4000;

  useEffect(() => {
    if (!visible) {
      setShowMessage(false);
      setSubmitting(false);
      dismissed.current = false;
      return;
    }

    let alive = true;

    const run = async () => {
      await runSignalHaptics(signalKind, soften);
      await delay(200);
      if (!alive) return;
      setShowMessage(true);
    };

    void run();

    const dismissTimer = setTimeout(() => {
      if (!alive || dismissed.current) return;
      dismissed.current = true;
      onDismiss();
    }, dismissMs);

    return () => {
      alive = false;
      clearTimeout(dismissTimer);
    };
  }, [visible, message, signalKind, onDismiss, soften, dismissMs]);

  const onPick = async (value: SignalFeedbackValue) => {
    if (submitting || interruptFeedback !== undefined || !interruptDeliveryId) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmitInterruptFeedback(value);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="none" transparent>
      <View style={styles.backdrop}>
        {showMessage ? (
          <View style={styles.stack}>
            <Text style={styles.message}>{message}</Text>
            {interruptDeliveryId ? (
              <View style={styles.feedbackBlock} accessibilityElementsHidden={!showMessage}>
                {interruptFeedback ? (
                  <Text style={styles.feedbackThanks}>Got it.</Text>
                ) : (
                  <>
                    <Text style={styles.feedbackPrompt}>Did this help?</Text>
                    <View style={styles.feedbackRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Helped"
                        disabled={submitting}
                        onPress={() => void onPick("helped")}
                        style={({ pressed }) => [styles.feedbackChip, pressed && styles.feedbackChipPressed]}
                      >
                        <Text style={styles.feedbackChipLabel}>Helped</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Not now"
                        disabled={submitting}
                        onPress={() => void onPick("not_now")}
                        style={({ pressed }) => [styles.feedbackChip, pressed && styles.feedbackChipPressed]}
                      >
                        <Text style={styles.feedbackChipLabel}>Not now</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Too much"
                        disabled={submitting}
                        onPress={() => void onPick("too_much")}
                        style={({ pressed }) => [styles.feedbackChip, pressed && styles.feedbackChipPressed]}
                      >
                        <Text style={styles.feedbackChipLabel}>Too much</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  stack: {
    alignItems: "center",
    maxWidth: 400,
  },
  message: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 34,
    textAlign: "center",
  },
  feedbackBlock: {
    marginTop: spacing.lg,
    alignItems: "center",
    alignSelf: "stretch",
  },
  feedbackPrompt: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  feedbackRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
  },
  feedbackChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  feedbackChipPressed: {
    opacity: 0.75,
  },
  feedbackChipLabel: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  feedbackThanks: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  placeholder: {
    width: 1,
    height: 1,
  },
});
