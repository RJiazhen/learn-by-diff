declare module "*.css";

declare module "*.vue" {
  const component: unknown;
  export default component;
}
