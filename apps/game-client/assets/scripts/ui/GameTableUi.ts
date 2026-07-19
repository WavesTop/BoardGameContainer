import {
  Button,
  HorizontalTextAlignment,
  Node,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
  resources,
} from "cc";

import { theme } from "../core/theme/Theme";
import { button, panel, place, text, type RectOptions } from "./UiKit";

export function tableBackdrop(
  parent: Node,
  name: string,
  resourcePath: string,
  fallbackColor: string,
): Node {
  panel(parent, `${name}Fallback`, {
    x: 0,
    y: 0,
    width: 1600,
    height: 900,
    color: fallbackColor,
  });

  const node = new Node(name);
  parent.addChild(node);
  place(node, { x: 0, y: 0, width: 1600, height: 900 });
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  resources.load(`${resourcePath}/texture`, Texture2D, (error, texture) => {
    if (error) {
      console.warn(`[GameTableUi] failed to load ${resourcePath}`, error);
      return;
    }
    if (!node.isValid) return;
    const frame = new SpriteFrame();
    frame.texture = texture;
    sprite.spriteFrame = frame;
  });
  return node;
}

function gamePieceImage(
  parent: Node,
  name: string,
  resourcePath: string,
  options: RectOptions,
): Node {
  const node = new Node(name);
  parent.addChild(node);
  place(node, options);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  resources.load(`${resourcePath}/texture`, Texture2D, (error, texture) => {
    if (error) {
      console.warn(`[GameTableUi] failed to load ${resourcePath}`, error);
      return;
    }
    if (!node.isValid) return;
    const frame = new SpriteFrame();
    frame.texture = texture;
    sprite.spriteFrame = frame;
  });
  return node;
}

export interface PlayerPlateOptions extends RectOptions {
  avatar: string;
  avatarResourcePath?: string;
  name: string;
  detail: string;
  active?: boolean;
  dealer?: boolean;
  accent?: string;
}

export function playerPlate(
  parent: Node,
  name: string,
  options: PlayerPlateOptions,
): Node {
  const active = options.active ?? false;
  panel(parent, `${name}Shadow`, {
    x: options.x + 4,
    y: options.y + 6,
    width: options.width,
    height: options.height,
    radius: options.radius ?? 18,
    color: "#020A18",
    alpha: 180,
  });
  const plate = panel(parent, name, {
    ...options,
    color: active ? "#163F55" : "#0B2036",
    alpha: active ? 242 : 226,
    radius: options.radius ?? 18,
    stroke: active ? "#FFD978" : "#6D87A5",
    strokeWidth: active ? 4 : 2,
  });
  panel(parent, `${name}AvatarRing`, {
    x: options.x + 10,
    y: options.y + 10,
    width: options.height - 20,
    height: options.height - 20,
    radius: (options.height - 20) / 2,
    color: options.accent ?? "#7657A3",
    stroke: "#F6D98B",
    strokeWidth: 3,
  });
  if (options.avatarResourcePath) {
    const portraitSize = options.height - 28;
    const portrait = new Node(`${name}Portrait`);
    parent.addChild(portrait);
    place(portrait, {
      x: options.x + 14,
      y: options.y + 14,
      width: portraitSize,
      height: portraitSize,
    });
    const sprite = portrait.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    resources.load(
      `${options.avatarResourcePath}/texture`,
      Texture2D,
      (error, texture) => {
        if (error) {
          console.warn(
            `[GameTableUi] failed to load ${options.avatarResourcePath}`,
            error,
          );
          return;
        }
        if (!portrait.isValid) return;
        const frame = new SpriteFrame();
        frame.texture = texture;
        sprite.spriteFrame = frame;
      },
    );
  }
  panel(parent, `${name}AvatarGlow`, {
    x: options.x + 17,
    y: options.y + 17,
    width: options.height - 34,
    height: Math.max(18, (options.height - 34) * 0.38),
    radius: 999,
    color: "#FFFFFF",
    alpha: 34,
  });
  if (!options.avatarResourcePath) {
    text(parent, `${name}AvatarText`, {
      x: options.x + 10,
      y: options.y + 10,
      width: options.height - 20,
      height: options.height - 20,
      text: options.avatar,
      fontSize: Math.round(options.height * 0.28),
      bold: true,
      align: HorizontalTextAlignment.CENTER,
    });
  }
  const contentX = options.x + options.height + 3;
  const contentWidth = options.width - options.height - 13;
  text(parent, `${name}Name`, {
    x: contentX,
    y: options.y + 7,
    width: contentWidth,
    height: Math.round(options.height * 0.34),
    text: options.name,
    fontSize: Math.max(14, Math.round(options.height * 0.18)),
    bold: true,
  });
  text(parent, `${name}Detail`, {
    x: contentX,
    y: options.y + Math.round(options.height * 0.39),
    width: contentWidth,
    height: Math.round(options.height * 0.5),
    text: options.detail,
    fontSize: Math.max(11, Math.round(options.height * 0.13)),
    lineHeight: Math.max(16, Math.round(options.height * 0.21)),
    color: active ? "#8AF2DC" : theme.color.textMuted,
  });
  if (options.dealer) {
    panel(parent, `${name}DealerBadge`, {
      x: options.x + options.width - 28,
      y: options.y - 9,
      width: 32,
      height: 32,
      radius: 16,
      color: "#F3D06D",
      stroke: "#FFF0B9",
      strokeWidth: 2,
    });
    text(parent, `${name}DealerText`, {
      x: options.x + options.width - 28,
      y: options.y - 9,
      width: 32,
      height: 32,
      text: "D",
      fontSize: 15,
      bold: true,
      color: "#49310E",
      align: HorizontalTextAlignment.CENTER,
    });
  }
  return plate;
}

export interface PlayingCardOptions extends RectOptions {
  label?: string;
  red?: boolean;
  selected?: boolean;
  enabled?: boolean;
  back?: boolean;
  onClick?: () => void;
}

export function playingCard(
  parent: Node,
  name: string,
  options: PlayingCardOptions,
): Node {
  const selected = options.selected ?? false;
  const label = (options.label ?? "").replace(/\s/g, "");
  const hasSuit = /[♠♥♣♦]$/.test(label);
  const suit = hasSuit ? label.slice(-1) : "";
  const regularResource =
    suit === "♠"
      ? "ui/game-pieces/playing-card-spade"
      : suit === "♥"
        ? "ui/game-pieces/playing-card-heart"
        : suit === "♣"
          ? "ui/game-pieces/playing-card-club"
          : suit === "♦"
            ? "ui/game-pieces/playing-card-diamond"
            : "ui/game-pieces/playing-card-front";
  const jokerResource = label.includes("大王")
    ? "ui/game-pieces/joker-big"
    : label.includes("小王")
      ? "ui/game-pieces/joker-small"
      : undefined;
  panel(parent, `CardShadow-${name}`, {
    x: options.x + 4,
    y: options.y + 7,
    width: options.width,
    height: options.height,
    radius: options.radius ?? 10,
    color: "#031222",
    alpha: 190,
  });
  gamePieceImage(
    parent,
    `${name}Skin`,
    options.back
      ? "ui/game-pieces/playing-card-back"
      : (jokerResource ?? regularResource),
    options,
  );
  if (selected) {
    panel(parent, `${name}Selected`, {
      ...options,
      color: "#FFFFFF",
      alpha: 0,
      stroke: "#EFFF65",
      strokeWidth: 4,
      radius: options.radius ?? 10,
    });
  }
  const card = panel(parent, name, {
    ...options,
    color: "#FFFFFF",
    alpha: 0,
  });
  if (options.onClick) {
    const component = card.addComponent(Button);
    component.transition = Button.Transition.NONE;
    component.interactable = options.enabled ?? true;
    card.on(Button.EventType.CLICK, options.onClick);
  }

  if (options.back) {
    return card;
  }
  if (jokerResource) return card;

  const rank = hasSuit ? label.slice(0, -1) : label;
  const foreground = options.red ? "#D93C38" : "#17243B";
  text(parent, `${name}Corner`, {
    x: options.x + Math.max(3, options.width * 0.06),
    y: options.y + Math.max(3, options.width * 0.05),
    width: options.width * 0.42,
    height: options.height * 0.42,
    text: `${rank}\n${suit}`,
    fontSize: Math.max(11, Math.round(options.width * 0.28)),
    lineHeight: Math.max(13, Math.round(options.width * 0.28)),
    bold: true,
    color: foreground,
    align: HorizontalTextAlignment.CENTER,
  });
  return card;
}

export interface MahjongTileOptions extends RectOptions {
  label: string;
  foreground: string;
  rank?: number;
  suit?: "wan" | "tong" | "tiao";
  selected?: boolean;
  enabled?: boolean;
  onClick?: () => void;
}

export function mahjongTileBack(
  parent: Node,
  name: string,
  options: RectOptions,
): Node {
  const horizontal = options.width > options.height;
  const tile = gamePieceImage(
    parent,
    name,
    "ui/game-pieces/mahjong-tile-back",
    horizontal
      ? {
          x: options.x,
          y: options.y,
          width: options.height,
          height: options.width,
        }
      : options,
  );
  if (!horizontal) return tile;

  const transform = tile.getComponent(UITransform);
  transform?.setAnchorPoint(0.5, 0.5);
  tile.setPosition(
    options.x + options.width / 2,
    -(options.y + options.height / 2),
  );
  tile.angle = -90;
  return tile;
}

export function mahjongTile(
  parent: Node,
  name: string,
  options: MahjongTileOptions,
): Node {
  const selected = options.selected ?? false;
  const radius = options.radius ?? Math.max(6, options.width * 0.11);
  panel(parent, `TileShadow-${name}`, {
    x: options.x + Math.max(3, options.width * 0.06),
    y: options.y + Math.max(7, options.height * 0.1),
    width: options.width,
    height: options.height,
    radius,
    color: "#032F26",
    alpha: 220,
  });
  gamePieceImage(
    parent,
    `${name}Skin`,
    options.rank && options.suit
      ? `ui/mahjong-faces/${options.suit}-${options.rank}`
      : "ui/game-pieces/mahjong-tile-blank",
    options,
  );
  if (selected) {
    panel(parent, `${name}Selected`, {
      ...options,
      color: "#FFFFFF",
      alpha: 0,
      radius,
      stroke: "#A8FF53",
      strokeWidth: 4,
    });
  }
  const face = panel(parent, name, {
    ...options,
    color: "#FFFFFF",
    alpha: 0,
  });
  if (options.onClick) {
    const component = face.addComponent(Button);
    component.transition = Button.Transition.NONE;
    component.interactable = options.enabled ?? true;
    face.on(Button.EventType.CLICK, options.onClick);
  }
  if (!options.rank || !options.suit) {
    text(parent, `${name}Text`, {
      x: options.x + options.width * 0.08,
      y: options.y + options.height * 0.12,
      width: options.width * 0.84,
      height: options.height * 0.64,
      text: options.label,
      fontSize: Math.max(12, Math.round(options.width * 0.32)),
      bold: true,
      color: options.foreground,
      align: HorizontalTextAlignment.CENTER,
    });
  }
  return face;
}

export function setButtonInteractable(node: Node, interactable: boolean): void {
  const component = node.getComponent(Button);
  if (component) component.interactable = interactable;
}
