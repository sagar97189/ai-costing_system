import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const SIMULATION_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SIMULATION_FRAGMENT_SHADER = `
uniform sampler2D positions;
uniform vec2 uMouse;
uniform float uTime;
uniform sampler2D uMask;
varying vec2 vUv;

// Simplex 3D Noise
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

vec3 snoiseVec3( vec3 x ){
  float s  = snoise(vec3( x ));
  float s1 = snoise(vec3( x.y - 19.1 , x.z + 33.4 , x.x + 47.2 ));
  float s2 = snoise(vec3( x.z + 74.2 , x.x - 124.5 , x.y + 99.4 ));
  vec3 c = vec3( s , s1 , s2 );
  return c;
}

vec3 curlNoise( vec3 p ){
  const float e = .1;
  vec3 dx = vec3( e   , 0.0 , 0.0 );
  vec3 dy = vec3( 0.0 , e   , 0.0 );
  vec3 dz = vec3( 0.0 , 0.0 , e   );
  vec3 p_x0 = snoiseVec3( p - dx );
  vec3 p_x1 = snoiseVec3( p + dx );
  vec3 p_y0 = snoiseVec3( p - dy );
  vec3 p_y1 = snoiseVec3( p + dy );
  vec3 p_z0 = snoiseVec3( p - dz );
  vec3 p_z1 = snoiseVec3( p + dz );
  float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
  float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
  float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;
  const float divisor = 1.0 / ( 2.0 * e );
  return normalize( vec3( x , y , z ) * divisor );
}

void main() {
  vec4 pos = texture2D(positions, vUv);
  
  // Mask boundary check
  // Screen coords roughly -1 to 1. Map to 0 to 1 for mask.
  vec2 maskUv = pos.xy * 0.5 + 0.5;
  vec4 maskVal = texture2D(uMask, maskUv);
  
  float distToMouse = length(pos.xy - uMouse);
  float influence = smoothstep(0.4, 0.0, distToMouse); // Mouse interaction radius
  
  vec3 curl = curlNoise(vec3(pos.x * 3.0, pos.y * 3.0, uTime * 0.2));
  
  // Velocity calculation
  vec2 vel = curl.xy * 0.008 * influence;
  
  // Update position
  pos.xy += vel;
  
  // Reset particle if outside mask or life ends, randomize slightly
  pos.z -= 0.01; // Life
  if(pos.z <= 0.0 || maskVal.a < 0.1 || maskUv.x < 0.0 || maskUv.x > 1.0 || maskUv.y < 0.0 || maskUv.y > 1.0) {
    pos.xy = uMouse + (vec2(snoise(vec3(vUv.x, vUv.y, uTime)), snoise(vec3(vUv.y, vUv.x, uTime))) * 0.1);
    pos.z = 1.0 + snoise(vec3(vUv.x, vUv.y, 0.0)) * 0.5; // New life
    // Only spawn if inside mask
    vec2 testUv = pos.xy * 0.5 + 0.5;
    if(texture2D(uMask, testUv).a < 0.1) {
      pos.z = 0.0; // Keep dead until mouse moves over valid area
    }
  }

  gl_FragColor = pos;
}
`;

const RENDER_VERTEX_SHADER = `
uniform sampler2D positions;
uniform float uSize;
varying float vLife;

void main() {
  vec4 pos = texture2D(positions, position.xy);
  vLife = pos.z;
  
  vec4 mvPosition = modelViewMatrix * vec4(pos.xy, 0.0, 1.0);
  gl_PointSize = uSize * (vLife);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const RENDER_FRAGMENT_SHADER = `
varying float vLife;
uniform vec3 uColor;

void main() {
  if (vLife <= 0.0) discard;
  
  // Soft circle particle
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;
  
  float alpha = smoothstep(0.5, 0.1, dist) * vLife * 0.4; // Soft glow
  
  gl_FragColor = vec4(uColor, alpha);
}
`;

// GPGPU Helper Component
const GPGPU = ({ size, maskTexture, mouseTarget }: { size: number, maskTexture: THREE.Texture | null, mouseTarget: React.MutableRefObject<THREE.Vector2> }) => {
  const gl = useThree((state) => state.gl);
  
  const simMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: SIMULATION_VERTEX_SHADER,
      fragmentShader: SIMULATION_FRAGMENT_SHADER,
      uniforms: {
        positions: { value: null },
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(-10, -10) },
        uMask: { value: maskTexture || new THREE.Texture() }
      }
    });
  }, []);

  useEffect(() => {
    if (maskTexture) {
      simMaterial.uniforms.uMask.value = maskTexture;
    }
  }, [maskTexture, simMaterial]);

  const { scene, camera, targetA, targetB } = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Initial data
    const data = new Float32Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      data[i * 4] = (Math.random() - 0.5) * 2.0; // x
      data[i * 4 + 1] = (Math.random() - 0.5) * 2.0; // y
      data[i * 4 + 2] = 0.0; // z (life)
      data[i * 4 + 3] = 0.0; // w
    }
    const initTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    initTexture.needsUpdate = true;
    
    simMaterial.uniforms.positions.value = initTexture;
    
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
    scene.add(mesh);
    
    const targetA = new THREE.WebGLRenderTarget(size, size, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    const targetB = targetA.clone();
    
    return { scene, camera, targetA, targetB };
  }, [size, simMaterial]);

  const renderMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: RENDER_VERTEX_SHADER,
      fragmentShader: RENDER_FRAGMENT_SHADER,
      uniforms: {
        positions: { value: null },
        uSize: { value: 6.0 }, // Point size
        uColor: { value: new THREE.Color('#FF6B3D') } // Glowing orange
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }, []);

  const particlesGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const pUvs = new Float32Array(size * size * 2);
    for(let y=0; y<size; y++) {
      for(let x=0; x<size; x++) {
        pUvs[(y*size+x)*2] = x / size;
        pUvs[(y*size+x)*2+1] = y / size;
      }
    }
    // We pass the UVs as positions, vertex shader samples texture to get actual pos
    geom.setAttribute('position', new THREE.BufferAttribute(pUvs, 2));
    return geom;
  }, [size]);

  // Ping pong loop
  const pingPong = useRef(0);
  
  useFrame(({ clock }) => {
    simMaterial.uniforms.uTime.value = clock.elapsedTime;
    simMaterial.uniforms.uMouse.value.lerp(mouseTarget.current, 0.1);
    
    // Render simulation
    const nextTarget = pingPong.current % 2 === 0 ? targetB : targetA;
    
    gl.setRenderTarget(nextTarget);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    
    // Update render material to use new positions
    simMaterial.uniforms.positions.value = nextTarget.texture;
    renderMat.uniforms.positions.value = nextTarget.texture;
    
    pingPong.current++;
  });

  return (
    <points geometry={particlesGeom} material={renderMat} />
  );
};

export const ParticleBrush = ({ text = "MODI" }: { text?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseTarget = useRef(new THREE.Vector2(-10, -10));
  const [maskTexture, setMaskTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    // Generate text mask canvas
    if (!containerRef.current) return;
    const canvas = document.createElement('canvas');
    const rect = containerRef.current.getBoundingClientRect();
    canvas.width = rect.width * 2; // HiDPI
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      // Match the CSS styling of the parent
      // font-anton uppercase leading-none tracking-tighter w-full text-center scale-y-[0.65]
      // font size is clamp(80px, 34vw, 900px)
      const fontSize = Math.max(80, Math.min(rect.width * 0.34, 900)) * 2;
      ctx.font = `${fontSize}px Anton, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = '-0.05em';
      // Apply scale-y vertically
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(1, 0.65);
      ctx.fillText(text, 0, 0);
      ctx.restore();
      
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      setMaskTexture(tex);
    }
  }, [text]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * 2 - 1;
    const y = -(e.clientY - rect.top) / rect.height * 2 + 1;
    mouseTarget.current.set(x, y);
  };

  const handlePointerLeave = () => {
    mouseTarget.current.set(-10, -10); // Move mouse far away
  };

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 z-30 touch-none pointer-events-auto"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Canvas
        camera={{ position: [0, 0, 1] }}
        gl={{ alpha: true, antialias: false }}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <GPGPU size={256} maskTexture={maskTexture} mouseTarget={mouseTarget} />
      </Canvas>
    </div>
  );
};
