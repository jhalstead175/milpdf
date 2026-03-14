import { createSelectTool } from './selectTool';
import { createTextTool } from './textTool';
import { createHighlightTool } from './highlightTool';
import { createRedactTool } from './redactTool';
import { createDrawTool } from './drawTool';
import { createEditTool } from './editTool';
import { createCropTool } from './cropTool';
import { createSignatureTool } from './signatureTool';
import { createImageTool } from './imageTool';

export function createToolRegistry(ctx) {
  return {
    select: createSelectTool(ctx),
    text: createTextTool(ctx),
    highlight: createHighlightTool(ctx),
    redact: createRedactTool(ctx),
    draw: createDrawTool(ctx),
    edit: createEditTool(ctx),
    crop: createCropTool(ctx),
    signature: createSignatureTool(ctx),
    image: createImageTool(ctx),
  };
}
