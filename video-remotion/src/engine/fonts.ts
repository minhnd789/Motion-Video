import { loadFont as anton } from "@remotion/google-fonts/Anton";
import { loadFont as bangers } from "@remotion/google-fonts/Bangers";
import { loadFont as beVietnamPro } from "@remotion/google-fonts/BeVietnamPro";
import { loadFont as charm } from "@remotion/google-fonts/Charm";
import { loadFont as dancingScript } from "@remotion/google-fonts/DancingScript";
import { loadFont as lexend } from "@remotion/google-fonts/Lexend";
import { loadFont as lobster } from "@remotion/google-fonts/Lobster";
import { loadFont as mali } from "@remotion/google-fonts/Mali";
import { loadFont as montserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as nunito } from "@remotion/google-fonts/Nunito";
import { loadFont as oswald } from "@remotion/google-fonts/Oswald";
import { loadFont as pacifico } from "@remotion/google-fonts/Pacifico";
import { loadFont as pattaya } from "@remotion/google-fonts/Pattaya";
import { loadFont as playfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as quicksand } from "@remotion/google-fonts/Quicksand";
import { loadFont as roboto } from "@remotion/google-fonts/Roboto";

// Mọi font ở đây đều có bộ ký tự tiếng Việt.
const loaders: Record<string, () => unknown> = {
  "Be Vietnam Pro": () =>
    beVietnamPro("normal", { weights: ["400", "600", "800", "900"], subsets: ["vietnamese", "latin"] }),
  Montserrat: () =>
    montserrat("normal", { weights: ["400", "600", "800", "900"], subsets: ["vietnamese", "latin"] }),
  Roboto: () => roboto("normal", { weights: ["400", "700", "900"], subsets: ["vietnamese", "latin"] }),
  Lexend: () => lexend("normal", { weights: ["400", "600", "800"], subsets: ["vietnamese", "latin"] }),
  Nunito: () => nunito("normal", { weights: ["400", "700", "900"], subsets: ["vietnamese", "latin"] }),
  Quicksand: () => quicksand("normal", { weights: ["400", "600", "700"], subsets: ["vietnamese", "latin"] }),
  Oswald: () => oswald("normal", { weights: ["400", "600", "700"], subsets: ["vietnamese", "latin"] }),
  Anton: () => anton("normal", { weights: ["400"], subsets: ["vietnamese", "latin"] }),
  Bangers: () => bangers("normal", { weights: ["400"], subsets: ["vietnamese", "latin"] }),
  "Playfair Display": () =>
    playfair("normal", { weights: ["400", "700", "900"], subsets: ["vietnamese", "latin"] }),
  "Dancing Script": () =>
    dancingScript("normal", { weights: ["400", "700"], subsets: ["vietnamese", "latin"] }),
  Pacifico: () => pacifico("normal", { weights: ["400"], subsets: ["vietnamese", "latin"] }),
  Lobster: () => lobster("normal", { weights: ["400"], subsets: ["vietnamese", "latin"] }),
  Pattaya: () => pattaya("normal", { weights: ["400"], subsets: ["vietnamese", "latin"] }),
  Charm: () => charm("normal", { weights: ["400", "700"], subsets: ["vietnamese", "latin"] }),
  Mali: () => mali("normal", { weights: ["400", "600", "700"], subsets: ["vietnamese", "latin"] }),
};

export const FONT_NAMES = Object.keys(loaders);

const loaded = new Set<string>();

/** Tải font nếu chưa tải. Gọi nhiều lần cũng không sao. */
export const ensureFont = (name: string) => {
  if (!loaded.has(name)) {
    loaded.add(name);
    loaders[name]?.();
  }
  return name;
};
