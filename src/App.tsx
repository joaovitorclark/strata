import { Workspace, type WorkspaceProps } from "@/features/shell/Workspace";

export type AppProps = WorkspaceProps;

export default function App(props: AppProps = {}) {
  return <Workspace {...props} />;
}
