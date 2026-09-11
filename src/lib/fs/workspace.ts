import type { ToolCall } from "@/lib/agent/types";
import { bridgeExec, bridgeReadFile } from "./bridge";
import type { ExecPayload, ReadPayload } from "./host";

export type Workspace = {
  mode: "host";
  home: string;
};

export async function execTool(call: ToolCall): Promise<{
  result: string;
  ok: boolean;
  image?: string;
}> {
  const executed: ExecPayload = await bridgeExec({
    name: call.name,
    args: call.args ?? {},
  });
  return {
    result: executed.result,
    ok: executed.ok,
    image: executed.image,
  };
}

export async function readPreview(path: string): Promise<ReadPayload> {
  return bridgeReadFile(path);
}
