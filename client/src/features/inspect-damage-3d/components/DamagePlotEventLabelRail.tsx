'use client';

import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { DamagePlotLayout } from '../lib/damage-plot-types';

const DEFAULT_BAR_WIDTH = 0.8;
const LABEL_RAIL_WIDTH = 6.2;
const LABEL_TEXTURE_WIDTH = 1280;
const MAX_LABEL_TEXTURE_HEIGHT = 4096;
const LABEL_TEXT_COLOR = '#111827';
const LABEL_BACKGROUND_COLOR = '#ffffff';
const LABEL_ROW_LINE_COLOR = 'rgba(156, 163, 175, 0.5)';
const SELECTED_LABEL_BACKGROUND = 'rgba(37, 99, 235, 0.16)';

type DamagePlotEventLabelRailProps = {
  layout: DamagePlotLayout;
  selectedEventIds: ReadonlySet<string>;
  onToggleEvent: (eventId: string) => void;
};

function labelTextureHeight(eventCount: number): number {
  return Math.min(MAX_LABEL_TEXTURE_HEIGHT, Math.max(768, eventCount * 48));
}

function fontSizeForRow(rowHeight: number): number {
  return Math.max(18, Math.min(36, rowHeight * 0.9));
}

function truncateToWidth(
  context: CanvasRenderingContext2D,
  label: string,
  maxWidth: number,
): string {
  if (context.measureText(label).width <= maxWidth) return label;
  let next = label;
  while (next.length > 1 && context.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  return `${next}...`;
}

function createLabelTexture(
  labels: readonly string[],
  eventIds: readonly string[],
  selectedEventIds: ReadonlySet<string>,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_TEXTURE_WIDTH;
  canvas.height = labelTextureHeight(labels.length);
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);

  const rowHeight = canvas.height / Math.max(1, labels.length);
  const fontSize = fontSizeForRow(rowHeight);
  context.fillStyle = LABEL_BACKGROUND_COLOR;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  context.font = `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.fillStyle = LABEL_TEXT_COLOR;

  labels.forEach((label, index) => {
    const y = canvas.height - (index + 0.5) * rowHeight;
    if (selectedEventIds.has(eventIds[index] ?? '')) {
      context.fillStyle = SELECTED_LABEL_BACKGROUND;
      context.fillRect(0, y - rowHeight / 2, canvas.width, rowHeight);
      context.fillStyle = LABEL_TEXT_COLOR;
    }
    context.strokeStyle = LABEL_ROW_LINE_COLOR;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
    context.fillText(truncateToWidth(context, label, canvas.width - 24), canvas.width - 12, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function DamagePlotEventLabelRail({
  layout,
  selectedEventIds,
  onToggleEvent,
}: DamagePlotEventLabelRailProps) {
  const { cellSpacing, eventIds, eventLabels, bars } = layout;
  const eventCount = eventLabels.length;
  const barWidth = bars[0]?.scale[0] ?? DEFAULT_BAR_WIDTH;
  const lineExtension = barWidth * 2;
  const railDepth = Math.max(cellSpacing, eventCount * cellSpacing);
  const railCenterX = -lineExtension - 0.12 - LABEL_RAIL_WIDTH / 2;
  const railCenterZ = eventCount > 0 ? ((eventCount - 1) * cellSpacing) / 2 : 0;

  const labelTexture = useMemo(
    () => createLabelTexture(eventLabels, eventIds, selectedEventIds),
    [eventIds, eventLabels, selectedEventIds],
  );

  useEffect(() => () => labelTexture.dispose(), [labelTexture]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!event.uv || eventCount === 0) return;
    const index = Math.max(0, Math.min(eventCount - 1, Math.floor(event.uv.y * eventCount)));
    const eventId = eventIds[index];
    if (eventId) {
      onToggleEvent(eventId);
    }
  };

  if (eventCount === 0) return null;

  return (
    <mesh
      position={[railCenterX, 0.012, railCenterZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={handleClick}
      renderOrder={2}
      frustumCulled={false}
    >
      <planeGeometry args={[LABEL_RAIL_WIDTH, railDepth]} />
      <meshBasicMaterial
        map={labelTexture}
        transparent
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
