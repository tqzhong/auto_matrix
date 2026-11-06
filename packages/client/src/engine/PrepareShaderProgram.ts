import type { WebGLRenderer } from 'three';

type Program = NonNullable<WebGLRenderer['info']['programs']>[number];

/** Cache locations after parallel compilation reports completion. */
export function cacheReadyProgramLocations(renderer: WebGLRenderer, program: Program): void {
  const debug = renderer.debug, checks = debug.checkShaderErrors;
  try {
    if (checks && program.program) {
      const gl = renderer.getContext();
      // Log reads can block even after linking. Failed links still need the original diagnostics.
      if (gl.getProgramParameter(program.program, gl.LINK_STATUS) === true) debug.checkShaderErrors = false;
    }
    program.getUniforms();
  } finally { debug.checkShaderErrors = checks; }
}
