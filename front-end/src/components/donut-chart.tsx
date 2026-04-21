import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

export type DonutSegment = {
  key: string;
  value: number;
  color: string;
};

type Props = {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  activeKey?: string | null;
  children?: React.ReactNode;
};

/**
 * Lightweight donut ring using stroke-dasharray. No external chart deps.
 * `children` renders centered inside the donut for caption text.
 */
export function DonutChart({
  segments,
  size = 176,
  strokeWidth = 22,
  activeKey,
  children,
}: Props) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offsetAccum = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {segments.map((seg) => {
            const portion = Math.max(0, seg.value) / total;
            const dash = portion * circumference;
            const gap = circumference - dash;
            const rotation = (offsetAccum / total) * 360;
            offsetAccum += Math.max(0, seg.value);

            const isActive = activeKey === seg.key;
            const isDimmed = activeKey && !isActive;

            return (
              <Circle
                key={seg.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={seg.color}
                strokeWidth={isActive ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${dash} ${gap}`}
                strokeLinecap="butt"
                fill="none"
                opacity={isDimmed ? 0.35 : 1}
                originX={size / 2}
                originY={size / 2}
                rotation={rotation}
              />
            );
          })}
        </G>
      </Svg>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="none">
        {children}
      </View>
    </View>
  );
}
