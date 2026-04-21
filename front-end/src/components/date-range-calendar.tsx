/**
 * Lightweight two-tap calendar range picker.
 *
 * Pure React Native — no native modules, no rebuild required. First tap selects
 * the start date; second tap selects the end date. Tapping a date before the
 * current start resets the range to that new start.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  /** ISO date string (YYYY-MM-DD) or empty string. */
  startDate: string;
  /** ISO date string (YYYY-MM-DD) or empty string. */
  endDate: string;
  onChange: (start: string, end: string) => void;
  /** Accent color for selected days / range highlight. */
  accentColor?: string;
}

/** Parse YYYY-MM-DD → Date at local midnight, or null. */
function parseIsoDate(iso: string): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function DateRangeCalendar({
  startDate,
  endDate,
  onChange,
  accentColor = '#e2652f',
}: Props) {
  const parsedStart = useMemo(() => parseIsoDate(startDate), [startDate]);
  const parsedEnd = useMemo(() => parseIsoDate(endDate), [endDate]);

  const initialMonth = parsedStart ?? new Date();
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const today = stripTime(new Date());

  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDayPress = (d: Date) => {
    const selected = stripTime(d);
    const iso = toIsoDate(selected);

    // No range yet, or both set → start a new range.
    if (!parsedStart || (parsedStart && parsedEnd)) {
      onChange(iso, '');
      return;
    }
    // Start set, picking end: if earlier, treat as new start.
    if (selected.getTime() < parsedStart.getTime()) {
      onChange(iso, '');
      return;
    }
    if (selected.getTime() === parsedStart.getTime()) {
      // Same-day "range" — keep start, clear end (single-day event).
      onChange(iso, iso);
      return;
    }
    onChange(startDate, iso);
  };

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goPrev} hitSlop={10} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={18} color="#333" />
        </TouchableOpacity>
        <ThemedText style={styles.monthLabel}>
          {MONTH_LABELS[viewMonth]} {viewYear}
        </ThemedText>
        <TouchableOpacity onPress={goNext} hitSlop={10} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={18} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {DAY_LABELS.map((d, i) => (
          <ThemedText key={`${d}-${i}`} style={styles.weekLabel}>
            {d}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, i) => {
          if (!cell) {
            return <View key={`blank-${i}`} style={styles.cell} />;
          }
          const cellTime = cell.getTime();
          const isStart = parsedStart && cellTime === parsedStart.getTime();
          const isEnd = parsedEnd && cellTime === parsedEnd.getTime();
          const inRange =
            parsedStart &&
            parsedEnd &&
            cellTime > parsedStart.getTime() &&
            cellTime < parsedEnd.getTime();
          const isToday = cellTime === today.getTime();

          return (
            <TouchableOpacity
              key={cellTime}
              style={[
                styles.cell,
                inRange && { backgroundColor: `${accentColor}22` },
                (isStart || isEnd) && { backgroundColor: accentColor },
              ]}
              activeOpacity={0.7}
              onPress={() => handleDayPress(cell)}>
              <ThemedText
                style={[
                  styles.cellLabel,
                  isToday && styles.cellLabelToday,
                  (isStart || isEnd) && styles.cellLabelSelected,
                ]}>
                {cell.getDate()}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.hintRow}>
        <View style={[styles.hintDot, { backgroundColor: accentColor }]} />
        <ThemedText style={styles.hintText}>
          {parsedStart && parsedEnd
            ? `${toIsoDate(parsedStart)} → ${toIsoDate(parsedEnd)}`
            : parsedStart
              ? `Start: ${toIsoDate(parsedStart)} · tap end date`
              : 'Tap a start date'}
        </ThemedText>
      </View>
    </View>
  );
}

const CELL_H = 34;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#eadfc9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginBottom: 4,
  },
  navBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: CELL_H,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
    borderRadius: CELL_H / 2,
  },
  cellLabel: {
    fontSize: 13,
    color: '#222',
  },
  cellLabelToday: {
    fontWeight: '800',
    color: '#d96a3f',
  },
  cellLabelSelected: {
    color: '#fff',
    fontWeight: '800',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  hintDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hintText: {
    fontSize: 12,
    color: '#666',
  },
});
