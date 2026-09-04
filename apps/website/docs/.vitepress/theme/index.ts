import { h, type Component } from "vue";
import DefaultTheme from "vitepress/theme";
import HomeAtmosphere from "./HomeAtmosphere.vue";
import "./custom.css";

/**
 * VitePress theme with LearnByDiff brand styles and a home-page atmosphere.
 */
export default {
  extends: DefaultTheme,
  /**
   * Renders the default layout and injects the home atmosphere above content.
   */
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "layout-top": () => h(HomeAtmosphere as Component),
    });
  },
};
