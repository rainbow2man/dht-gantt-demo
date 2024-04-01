// import { StrictMode } from "react";
import ReactDom from "react-dom";
// import { createRoot } from "react-dom/client";

import App from "./App";

const rootElement = document.getElementById("root");
// const root = createRoot(rootElement);

// root.render(
//   <StrictMode>

//   </StrictMode>
// );
ReactDom.render(<App />, rootElement);
