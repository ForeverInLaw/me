// The surface under the bio column: a slow grainy gradient, drawn by a
// fragment shader on a canvas of its own (.bio-glow, bio.css). Without WebGL2
// nothing is added and the column keeps its flat panel.

import { prefersReducedMotion } from './viewport.js';

// Sharper than this the grain only gets finer, at four times the pixels.
const MAX_PIXEL_RATIO = 2;

// One triangle that covers the whole clip space.
const COVER = new Float32Array([-1, -1, 3, -1, -1, 3]);

const VERTEX = `#version 300 es
in vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}`;

// Three tones are laid across a plane that slowly turns and ripples; the grain
// is fixed to the pixels, so only the colour under it moves.
const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
out vec4 fragColor;

const vec3 LIGHT = vec3(0.500, 0.275, 0.100);
const vec3 MID = vec3(0.250, 0.115, 0.060);
const vec3 DARK = vec3(0.050, 0.042, 0.036);

const float SPEED = 0.25;
const float ZOOM = 0.9;
const float TURN = 500.0;
const float GRAIN = 0.1;
const float CONTRAST = 1.08;
const float SATURATION = 1.0;

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37)));
    return fract(sin(p) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    float n = mix(
        mix(dot(-1.0 + 2.0 * hash(i), f), dot(-1.0 + 2.0 * hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
        mix(dot(-1.0 + 2.0 * hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(-1.0 + 2.0 * hash(i + vec2(1.0)), f - vec2(1.0)), u.x),
        u.y
    );
    return 0.5 + 0.5 * n;
}

void main() {
    float t = uTime * SPEED;
    vec2 uv = gl_FragCoord.xy / uResolution;
    float ratio = uResolution.x / uResolution.y;

    vec2 p = (uv - 0.5) / ZOOM;
    float turn = noise(vec2(t * 0.1, p.x * p.y) * 2.0);
    p.y /= ratio;
    p *= rot(radians((turn - 0.5) * TURN + 180.0));
    p.y *= ratio;
    p.x += sin(p.y * 5.0 + t * 2.0) / 50.0;
    p.y += sin(p.x * 7.5 + t * 2.0) / 25.0;

    float across = smoothstep(-0.35, 0.25, p.x);
    vec3 col = mix(mix(MID, LIGHT, across), mix(DARK, MID, across), smoothstep(-0.35, 0.55, p.y));

    col += (fract(sin(dot(uv * 2.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * GRAIN;
    col = (col - 0.5) * CONTRAST + 0.5;
    col = mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, SATURATION);
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.error('Bio glow shader failed to compile:', gl.getShaderInfoLog(shader));
    return null;
}

/** The linked program, in use and fed its one triangle; null if it does not build. */
function createProgram(gl) {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Bio glow program failed to link:', gl.getProgramInfoLog(program));
        return null;
    }
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, COVER, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    return program;
}

export function initBioGlow() {
    const host = document.querySelector('.bio-glow');
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false });
    const program = host && gl && createProgram(gl);
    if (!program) return;

    const resolution = gl.getUniformLocation(program, 'uResolution');
    const time = gl.getUniformLocation(program, 'uTime');
    host.append(canvas);

    const draw = (now = performance.now()) => {
        gl.uniform1f(time, now / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // Runs only while the column is on screen; under reduced motion the
    // gradient is drawn once and stands still.
    let frame = 0;
    const run = (now) => {
        draw(now);
        frame = requestAnimationFrame(run);
    };
    const still = prefersReducedMotion();

    // Resizing a canvas clears it, so it is drawn again at once rather than
    // left blank until the next frame.
    new ResizeObserver(() => {
        const ratio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
        canvas.width = Math.round(host.clientWidth * ratio);
        canvas.height = Math.round(host.clientHeight * ratio);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(resolution, canvas.width, canvas.height);
        draw();
        host.classList.add('is-lit');
    }).observe(host);

    new IntersectionObserver(([entry]) => {
        cancelAnimationFrame(frame);
        frame = entry.isIntersecting && !still ? requestAnimationFrame(run) : 0;
    }).observe(host);
}
