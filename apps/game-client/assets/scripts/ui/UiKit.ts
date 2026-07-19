import {
  Button,
  Color,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Node,
  UITransform,
  VerticalTextAlignment,
} from "cc";

import { theme } from "../core/theme/Theme";

export interface RectOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  alpha?: number;
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
}

export interface TextOptions extends RectOptions {
  text: string;
  fontSize?: number;
  lineHeight?: number;
  bold?: boolean;
  align?: HorizontalTextAlignment;
  verticalAlign?: VerticalTextAlignment;
}

export function color(hex: string, alpha?: number): Color {
  const result = Color.fromHEX(new Color(), hex);
  if (alpha !== undefined) result.a = alpha;
  return result;
}

export function place(node: Node, options: RectOptions): UITransform {
  const transform =
    node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setAnchorPoint(0, 1);
  transform.setContentSize(options.width, options.height);
  node.setPosition(options.x, -options.y);
  return transform;
}

export function panel(parent: Node, name: string, options: RectOptions): Node {
  const node = new Node(name);
  parent.addChild(node);
  place(node, options);

  node.addComponent(Graphics);
  repaintPanel(node, options);
  return node;
}

export function repaintPanel(
  node: Node,
  options: Omit<RectOptions, "x" | "y" | "width" | "height">,
): void {
  const transform = node.getComponent(UITransform);
  const graphics = node.getComponent(Graphics);
  if (!transform || !graphics) return;

  graphics.clear();
  graphics.fillColor = color(
    options.color ?? theme.color.surface,
    options.alpha,
  );
  if (options.stroke) {
    graphics.strokeColor = color(options.stroke);
    graphics.lineWidth = options.strokeWidth ?? 1;
  }
  const radius = options.radius ?? 0;
  if (radius > 0)
    graphics.roundRect(
      0,
      -transform.height,
      transform.width,
      transform.height,
      radius,
    );
  else graphics.rect(0, -transform.height, transform.width, transform.height);
  graphics.fill();
  if (options.stroke) graphics.stroke();
}

export function text(parent: Node, name: string, options: TextOptions): Label {
  const node = new Node(name);
  parent.addChild(node);
  const transform = place(node, options);
  transform.setAnchorPoint(0, 1);

  const label = node.addComponent(Label);
  label.string = options.text;
  label.fontSize = options.fontSize ?? 20;
  label.lineHeight =
    options.lineHeight ?? Math.round((options.fontSize ?? 20) * 1.35);
  label.color = color(options.color ?? theme.color.text);
  label.horizontalAlign = options.align ?? HorizontalTextAlignment.LEFT;
  label.verticalAlign = options.verticalAlign ?? VerticalTextAlignment.CENTER;
  label.overflow = Label.Overflow.SHRINK;
  label.isBold = options.bold ?? false;
  return label;
}

export function button(
  parent: Node,
  name: string,
  labelText: string,
  options: RectOptions & {
    textColor?: string;
    enabled?: boolean;
    sheen?: boolean;
  },
  onClick: () => void,
): Node {
  const node = panel(parent, name, {
    ...options,
    color:
      options.enabled === false
        ? theme.color.outline
        : (options.color ?? theme.color.primary),
  });
  const component = node.addComponent(Button);
  component.transition = Button.Transition.SCALE;
  component.zoomScale = 0.97;
  component.interactable = options.enabled ?? true;
  node.on(Button.EventType.CLICK, onClick);

  if (options.sheen !== false && options.enabled !== false) {
    panel(node, `${name}Sheen`, {
      x: 3,
      y: 3,
      width: Math.max(4, options.width - 6),
      height: Math.max(4, options.height * 0.34),
      radius: Math.max(3, (options.radius ?? 10) - 3),
      color: "#FFFFFF",
      alpha: 36,
    });
  }

  text(node, `${name}Label`, {
    x: 0,
    y: 0,
    width: options.width,
    height: options.height,
    text: labelText,
    fontSize: 20,
    bold: true,
    align: HorizontalTextAlignment.CENTER,
    color: options.textColor ?? theme.color.background,
  });
  return node;
}

export function chip(
  parent: Node,
  name: string,
  labelText: string,
  x: number,
  y: number,
  width: number,
  background: string = theme.color.surfaceRaised,
  foreground: string = theme.color.textMuted,
): Node {
  const node = panel(parent, name, {
    x,
    y,
    width,
    height: 30,
    radius: 15,
    color: background,
  });
  text(node, `${name}Label`, {
    x: 0,
    y: 0,
    width,
    height: 30,
    text: labelText,
    fontSize: 14,
    align: HorizontalTextAlignment.CENTER,
    color: foreground,
  });
  return node;
}

export function clearChildren(node: Node): void {
  for (const child of [...node.children]) child.destroy();
}
