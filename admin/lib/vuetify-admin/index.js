import Vue from "vue";
import * as core from "./components/Core";
import * as ui from "./components/UI";
import PortalVue from "portal-vue";
import isEmpty from "lodash/isEmpty";
import capitalize from "lodash/capitalize";

import layout from "./store/layout";
import aside from "./store/aside";
import auth from "./store/auth";
import api from "./store/api";
import form from "./store/form";

import resourceCrudModule from "./store/resource";
import resourceCrudRoutes from "./router/resource";

export default class VuetifyAdmin {
  constructor({
    title,
    locales,
    authProvider,
    dataProvider,
    resources,
    resourcesPath
  }) {
    /**
     * Options properties
     */
    this.title = title;
    this.locales = locales;
    this.authProvider = authProvider;
    this.dataProvider = dataProvider;
    this.resourcesPath = resourcesPath;
    this.loaded = false;

    /**
     * Format usable resources object
     */
    this.resources = resources
      .map(r => {
        return typeof r === "string"
          ? {
              name: r
            }
          : r;
      })
      .map(r => {
        return {
          ...r,
          actions: ["list", "show", "create", "edit", "delete"].filter(a => {
            if ((r.only || []).length) {
              return r.only.includes(a);
            }

            if ((r.except || []).length) {
              return !r.except.includes(a);
            }

            return true;
          })
        };
      });

    if (resourcesPath) {
      this.resources.forEach(r => {
        r.actions
          .filter(a => a !== "delete")
          .forEach(a => {
            let componentPath = `${capitalize(r.name)}/${capitalize(a)}`;

            Vue.component(componentPath.replace("/", ""), () =>
              import(`@/${resourcesPath}/${componentPath}.vue`)
            );
          });
      });
    }
  }
  init({ router, store, i18n }) {
    if (this.loaded) {
      return;
    }

    /**
     * Load i18n locales
     */
    Object.keys(this.locales.ui).forEach(locale => {
      i18n.mergeLocaleMessage(locale, { va: this.locales.ui[locale] });
    });

    /**
     * Auth store & api dispatcher module injection
     */
    store.registerModule("layout", layout(i18n));
    store.registerModule("aside", aside);
    store.registerModule("api", api);
    store.registerModule("auth", auth(this.authProvider, router));
    store.registerModule("form", form);

    /**
     * Add API resources modules dynamically
     */
    this.resources.forEach(resource =>
      store.registerModule(
        resource.name,
        resourceCrudModule({
          provider: this.dataProvider,
          resource
        })
      )
    );

    /**
     * Add resources routes dynamically
     */
    router.addRoutes(
      this.resources.map(resource =>
        resourceCrudRoutes({
          store,
          i18n,
          resource
        })
      )
    );

    /**
     * Check Auth after each navigation
     */
    router.beforeEach((to, from, next) => {
      /**
       * Check and reload authenticated user with permissions
       * after each navigation
       */
      store.dispatch("auth/checkAuth");

      /**
       * Main title
       */
      store.commit("layout/setTitle", to.meta.title || this.title);
      store.commit("aside/close");
      document.title = to.meta.title
        ? `${to.meta.title} | ${this.title}`
        : this.title;

      next();
    });

    /**
     * Recheck auth on app visible (switching tabs,...)
     */
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        store.dispatch("auth/checkAuth");
      }
    });

    /**
     * Permissions helper & directive
     */
    this.can = permissions => {
      return !isEmpty(
        (Array.isArray(permissions) ? permissions : [permissions]).filter(
          p => -1 !== store.getters["auth/getPermissions"].indexOf(p)
        )
      );
    };

    this.loaded = true;
    store.dispatch("auth/checkAuth");
  }
}

VuetifyAdmin.install = Vue => {
  Vue.use(PortalVue);

  [core, ui].forEach(c => {
    Object.keys(c).forEach(name => {
      Vue.component(`Va${name}`, c[name]);
    });
  });

  Vue.mixin({
    beforeCreate() {
      let router = this.$router;
      let store = this.$store;
      let i18n = this.$i18n;
      let admin = this.$root.$options.admin;

      if (router && store && i18n) {
        /**
         * Instantiate admin when main dependencies are availables
         * Executed only once with loaded prop
         */
        admin.init({ router, store, i18n });
      }
      this.$admin = admin;
    }
  });

  Vue.directive("can", (el, binding, vnode) => {
    if (!vnode.context.$admin.can(binding.value)) {
      // replace HTMLElement with comment node
      const comment = document.createComment("");
      vnode.elm = comment;
      vnode.text = "";
      vnode.isComment = true;

      if (el.parentNode) {
        el.parentNode.replaceChild(comment, el);
      }
    }
  });
};