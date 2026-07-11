import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import type { KeyboardTypeOptions } from "react-native";

import { Pressed } from "../spec/Pressed";
import { useTheme } from "../../theme/ThemeContext";
import { fonts } from "../../theme/typeRoles";

type SheetTextFieldProps = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  maxLength?: number;
  /** Monospace tabular styling for numeric-amount fields. */
  numeric?: boolean;
};

/**
 * Sheet text field — matches LoginScreen's TextInput styling (surface bg,
 * hairline border, r16). The placeholder renders as a `<Text>` overlay, not
 * the native TextInput placeholder: iOS renders a custom-font placeholder
 * with unreliable metrics (see AskBar.tsx) — the native placeholder is left
 * empty and this overlay shows only while the field is empty.
 */
export function SheetTextField({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoFocus,
  maxLength,
  numeric,
}: SheetTextFieldProps) {
  const { c } = useTheme();
  return (
    <View style={styles.fieldWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder=""
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        maxLength={maxLength}
        style={[
          styles.field,
          numeric && styles.fieldNumeric,
          { backgroundColor: c.surface, borderColor: c.hairSection, color: c.ink },
        ]}
      />
      {value === "" ? (
        <Text
          style={[styles.placeholder, numeric && styles.fieldNumeric, { color: c.ink38 }]}
          numberOfLines={1}
          pointerEvents="none"
        >
          {placeholder}
        </Text>
      ) : null}
    </View>
  );
}

type SegmentedOption<T extends string> = { value: T; label: string };

type SegmentedToggleProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
};

/** Two/three-way pill toggle (asset/debt, income/expense, account type). */
export function SegmentedToggle<T extends string>({ options, value, onChange }: SegmentedToggleProps<T>) {
  const { c } = useTheme();
  return (
    <View style={styles.segmentRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressed
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.segmentPill,
              {
                borderColor: active ? c.accent : c.hairSection,
                backgroundColor: active ? c.bandWash : "transparent",
              },
            ]}
          >
            <Text style={[styles.segmentLabel, { color: active ? c.accent : c.ink50 }]}>{opt.label}</Text>
          </Pressed>
        );
      })}
    </View>
  );
}

type SheetPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

/** Accent CTA button — matches LoginScreen's primary button. */
export function SheetPrimaryButton({ label, onPress, disabled, loading }: SheetPrimaryButtonProps) {
  const { c } = useTheme();
  return (
    <Pressed
      // Every SheetPrimaryButton call site is a money save (add/edit account,
      // add transaction, set budget) — its real feedback is the success buzz
      // the caller fires from its own try/await success branch, not a
      // pressIn tick.
      haptic="success"
      style={[styles.button, { backgroundColor: c.accent }, (disabled || loading) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? <ActivityIndicator color={c.onAccent} size="small" /> : <Text style={[styles.buttonLabel, { color: c.onAccent }]}>{label}</Text>}
    </Pressed>
  );
}

/** Section label above a field group, e.g. "NAME" / "TYPE" / "VALUE". */
export function FieldLabel({ children }: { children: string }) {
  const { c } = useTheme();
  return <Text style={[styles.fieldLabel, { color: c.ink38 }]}>{children}</Text>;
}

/**
 * Inline mono error line for sheet/form writes — the app's spec error idiom
 * (matches TopMove.tsx's `errorMessage` line: mono, small, uppercase, red).
 * Money's sheets render this on a failed write (useMoney's addAccount /
 * updateAccountValue / addTransaction / setBudget all THROW on failure) so
 * the form stays open with the user's input instead of getting replaced by
 * MoneyScreen's screen-level retry row, which is READ-path only.
 */
export function FormError({ children }: { children: string }) {
  const { c } = useTheme();
  return <Text style={[styles.formError, { color: c.red }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  fieldWrap: {
    marginBottom: 4,
  },
  field: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: fonts.sans500,
    fontSize: 15,
  },
  fieldNumeric: {
    fontFamily: fonts.mono600,
    fontVariant: ["tabular-nums"],
  },
  placeholder: {
    position: "absolute",
    left: 16,
    top: 0,
    height: 52,
    textAlignVertical: "center",
    fontFamily: fonts.sans500,
    fontSize: 15,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  segmentPill: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
  },
  segmentLabel: {
    fontFamily: fonts.mono600,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  button: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    fontFamily: fonts.mono600,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  fieldLabel: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  formError: {
    fontFamily: fonts.mono500,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
});
