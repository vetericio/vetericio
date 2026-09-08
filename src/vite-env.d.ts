/// <reference types="vite/client" />

declare module "*?url" {
  const url: string;
  export default url;
}

declare module "*?worker" {
  const Worker: new () => globalThis.Worker;
  export default Worker;
}
