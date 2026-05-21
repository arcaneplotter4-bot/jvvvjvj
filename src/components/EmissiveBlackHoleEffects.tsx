import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// 3D Simplex Noise Shader Helper Chunks
const simplexNoiseGLSL = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - D.yyy;

  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ) )
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ) ) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ) );

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
`;

const getAdjustedFov = (width: number, height: number, baseFov: number = 48) => {
  const aspect = width / height;
  if (aspect < 1) {
    // Keep consistent horizontal framing on narrower orientations (portrait)
    const rad = (baseFov * Math.PI) / 180;
    const adjustedRad = 2 * Math.atan(Math.tan(rad / 2) / aspect);
    return (adjustedRad * 180) / Math.PI;
  }
  return baseFov;
};

const adjustTextureOffset = (texture: THREE.Texture, width: number, height: number, meshMaterialUniforms?: any, bgPassUniforms?: any) => {
  const image = texture.image as any;
  if (!image) return;
  const imageWidth = image.width || image.videoWidth;
  const imageHeight = image.height || image.videoHeight;
  if (!imageWidth || !imageHeight) return;

  const imageAspect = imageWidth / imageHeight;
  const screenAspect = width / height;

  texture.matrixAutoUpdate = false;
  if (screenAspect > imageAspect) {
    // Screen is wider than image aspect ratio: fit horizontally, crop vertically
    const repeatX = 1;
    const repeatY = imageAspect / screenAspect;
    texture.matrix.setUvTransform(0, 0, repeatX, repeatY, 0, 0.5, 0.5);
  } else {
    // Screen is taller than image aspect ratio: fit vertically, crop horizontally
    const repeatX = screenAspect / imageAspect;
    const repeatY = 1;
    texture.matrix.setUvTransform(0, 0, repeatX, repeatY, 0, 0.5, 0.5);
  }
  
  if (meshMaterialUniforms && meshMaterialUniforms.uTextureMatrix) {
    meshMaterialUniforms.uTextureMatrix.value.copy(texture.matrix);
  }
  if (bgPassUniforms && bgPassUniforms.uTextureMatrix) {
    bgPassUniforms.uTextureMatrix.value.copy(texture.matrix);
  }
};

const CustomBackgroundShader = {
  uniforms: {
    tDiffuse: { value: null },
    uBgTexture: { value: null },
    uHasBg: { value: false },
    uTextureMatrix: { value: new THREE.Matrix3() }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D uBgTexture;
    uniform bool uHasBg;
    uniform mat3 uTextureMatrix;
    varying vec2 vUv;
    void main() {
      vec4 sceneColor = texture2D( tDiffuse, vUv );
      if ( uHasBg ) {
        vec2 uv = (uTextureMatrix * vec3(vUv, 1.0)).xy;
        vec4 bgColor = texture2D( uBgTexture, uv );
        // High quality blending: foreground objects are blended using their alpha, 
        // while the bloom glow from the foreground naturally brightens the background
        vec3 finalColor = bgColor.rgb * ( 1.0 - sceneColor.a ) + sceneColor.rgb;
        gl_FragColor = vec4( finalColor, 1.0 );
      } else {
        gl_FragColor = sceneColor;
      }
    }
  `
};

export const EmissiveBlackHoleBackground = ({ performanceMode, settings }: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);

  // Sync settings ref
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Config parameters from settings or fallbacks
    const emissiveFrequency = settings?.emissiveFrequency ?? 0.25;
    const emissiveAmplitude = settings?.emissiveAmplitude ?? 16.0;
    const emissiveEdgeWidth = settings?.emissiveEdgeWidth ?? 0.8;
    const emissiveSpeed = settings?.emissiveSpeed ?? 1.0;
    const emissiveBloom = settings?.emissiveBloom ?? 8.0;
    const emissiveBloomThreshold = settings?.emissiveBloomThreshold ?? 0.15;
    const emissiveBloomRadius = settings?.emissiveBloomRadius ?? 0.4;
    const emissiveParticleSize = settings?.emissiveParticleSize ?? 120;
    const emissiveParticleCount = settings?.emissiveParticleCount ?? (performanceMode ? 1500 : 4000);
    const emissiveParticleLifespan = settings?.emissiveParticleLifespan ?? 1.5;
    const emissiveWaviness = settings?.emissiveWaviness ?? 1.0;
    const emissiveParticleSpeed = settings?.emissiveParticleSpeed ?? 1.0;
    const emissiveParticleDirectionX = settings?.emissiveParticleDirectionX ?? 0.0;
    const emissiveParticleDirectionY = settings?.emissiveParticleDirectionY ?? 1.5;
    const emissiveParticleDirectionZ = settings?.emissiveParticleDirectionZ ?? 0.0;
    const emissiveParticleSpread = settings?.emissiveParticleSpread ?? 1.5;
    const colorHex = settings?.colors?.[0] || '#4d9bff';

    const color = new THREE.Color(colorHex);

    const scene = new THREE.Scene();
    if (!settings?.emissiveCustomBackground) {
      scene.background = new THREE.Color(0x020205);
    }
    scene.fog = new THREE.FogExp2(0x020205, 0.015);

    const initialFov = getAdjustedFov(window.innerWidth, window.innerHeight, 48);
    const camera = new THREE.PerspectiveCamera(initialFov, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 30);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: !performanceMode, 
      powerPreference: 'high-performance',
      alpha: !!settings?.emissiveCustomBackground,
      premultipliedAlpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (settings?.emissiveCustomBackground) {
      renderer.setClearColor(0x000000, 0.0); // Full brightness background
    }
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.04;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5 * emissiveSpeed;
    controls.enablePan = false;
    controls.maxDistance = 60;
    controls.minDistance = 15;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 20, 15);
    scene.add(dirLight);

    // Load particle texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    const particleTexture = textureLoader.load('https://www.image2url.com/r2/default/images/1779293037155-d7413de7-4d2c-4c2a-b5e4-7e10e0d4ed5c.png');

    const emissiveShape = settings?.emissiveShape || 'torusKnot';

    const getGeometryForShape = (type: string) => {
      switch (type) {
        case 'torus':
          return new THREE.TorusGeometry(6.5, 2.0, 32, 64);
        case 'sphere':
          return new THREE.SphereGeometry(6.5, 64, 64);
        case 'icosahedron':
          return new THREE.IcosahedronGeometry(7, 3);
        case 'cube':
          return new THREE.BoxGeometry(8, 8, 8, 16, 16, 16);
        case 'cylinder':
          return new THREE.CylinderGeometry(4.5, 4.5, 10, 32, 16);
        case 'cone':
          return new THREE.ConeGeometry(5, 10, 32, 16);
        case 'torusKnot':
        default:
          return new THREE.TorusKnotGeometry(7, 1.8, 120, 16, 2, 3);
      }
    };

    // Create the central accretion mesh
    const geometry = getGeometryForShape(emissiveShape);
    
    // Load custom background texture if present
    let bgTexture: THREE.Texture | null = null;
    let videoEl: HTMLVideoElement | null = null;
    if (settings?.emissiveCustomBackground) {
      if (settings.emissiveCustomBackgroundType === 'video') {
        videoEl = document.createElement('video');
        videoEl.src = settings.emissiveCustomBackground;
        videoEl.loop = true;
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.crossOrigin = 'anonymous';
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("Auto-play prevented or interrupted:", error);
          });
        }
        bgTexture = new THREE.VideoTexture(videoEl);
        bgTexture.minFilter = THREE.LinearFilter;
        bgTexture.magFilter = THREE.LinearFilter;
        videoEl.addEventListener('loadeddata', () => {
          // Adjustments handled in the animation loop
        });
      } else {
        bgTexture = new THREE.TextureLoader().load(settings.emissiveCustomBackground);
      }
      bgTexture.colorSpace = THREE.SRGBColorSpace;
      // Do not set scene.background in order to keep the background transparent for the render pass,
      // which prevents the UnrealBloomPass from blurring/glowing the custom background.
      scene.background = null;
    }

    // Shader uniforms
    const uniforms = {
      uTime: { value: 0 },
      uDissolveColor: { value: color },
      uFreq: { value: emissiveFrequency },
      uAmp: { value: emissiveAmplitude },
      uEdge: { value: emissiveEdgeWidth },
      uSpeed: { value: emissiveSpeed },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uBgTexture: { value: bgTexture },
      uHasBg: { value: bgTexture !== null },
      uTextureMatrix: { value: new THREE.Matrix3() }
    };

    // Mesh shader material description
    const meshMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
      uniforms: uniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDissolveColor;
        uniform float uFreq;
        uniform float uAmp;
        uniform float uEdge;
        uniform float uSpeed;
        uniform vec2 uResolution;
        uniform sampler2D uBgTexture;
        uniform bool uHasBg;
        uniform mat3 uTextureMatrix;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec3 vPosition;

        ${simplexNoiseGLSL}

        void main() {
          vec3 localPosition = vPosition;
          
          float noiseVal = snoise(localPosition * uFreq + vec3(0.0, uTime * uSpeed * 0.1, 0.0));
          noiseVal = noiseVal * 0.5 + 0.5;

          float wave = sin(uTime * uSpeed * 0.2);
          float threshold = max(0.0, wave * 0.55 + 0.35);

          if (noiseVal < threshold) {
            discard;
          }

          float edgeAlpha = smoothstep(threshold, threshold + uEdge * 0.25, noiseVal);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);

          vec3 baseColor;
          if (uHasBg) {
             vec2 screenUV = gl_FragCoord.xy / uResolution;
             vec2 distort = vNormal.xy * 0.1 * fresnel;
             vec2 baseUV = screenUV + distort;
             vec2 refractedUV = (uTextureMatrix * vec3(baseUV, 1.0)).xy;
             
             // Wrap UVs to prevent edge artifacts
             refractedUV = fract(refractedUV);

             vec3 bgColor = texture2D(uBgTexture, refractedUV).rgb;
             // Mirror glass look (mostly background, with some specular/fresnel reflection)
             baseColor = clamp(mix(bgColor, vec3(1.0), fresnel * 0.4), 0.0, 1.0);
          } else {
             baseColor = clamp(vec3(0.01, 0.015, 0.03) + (uDissolveColor * 0.1 * fresnel), 0.0, 1.0);
          }
          
          vec3 emissiveEdge = uDissolveColor * (1.0 - edgeAlpha) * uAmp;
          vec3 finalColor = baseColor + emissiveEdge;
          
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });

    const mesh = new THREE.Mesh(geometry, meshMaterial);
    scene.add(mesh);

    // Particle system (emitted from disintegrated areas)
    const particleCount = emissiveParticleCount;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const normals = new Float32Array(particleCount * 3);
    const randoms = new Float32Array(particleCount * 3);

    // Fetch surface points on dynamic shape structure
    const tempTorusGeometry = getGeometryForShape(emissiveShape);
    const posAttr = tempTorusGeometry.attributes.position;
    const normAttr = tempTorusGeometry.attributes.normal;
    const vertexCount = posAttr.count;

    for (let i = 0; i < particleCount; i++) {
      const idx = Math.floor(Math.random() * vertexCount);
      
      positions[i * 3] = posAttr.getX(idx);
      positions[i * 3 + 1] = posAttr.getY(idx);
      positions[i * 3 + 2] = posAttr.getZ(idx);

      normals[i * 3] = normAttr.getX(idx);
      normals[i * 3 + 1] = normAttr.getY(idx);
      normals[i * 3 + 2] = normAttr.getZ(idx);

      // Random lifetime speeds
      randoms[i * 3] = Math.random(); // phase shift
      randoms[i * 3 + 1] = Math.random() * 0.5 + 0.5; // speed mult
      randoms[i * 3 + 2] = Math.random() * 2.0 - 1.0; // curl orientation
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
    particleGeometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));

    const particlesMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: color },
        uFreq: { value: emissiveFrequency },
        uAmp: { value: emissiveAmplitude },
        uEdge: { value: emissiveEdgeWidth },
        uSpeed: { value: emissiveSpeed },
        uBaseSize: { value: emissiveParticleSize },
        uTexture: { value: particleTexture },
        uLifespan: { value: emissiveParticleLifespan },
        uWaviness: { value: emissiveWaviness },
        uParticleSpeed: { value: emissiveParticleSpeed },
        uParticleDir: { value: new THREE.Vector3(emissiveParticleDirectionX, emissiveParticleDirectionY, emissiveParticleDirectionZ) },
        uParticleSpread: { value: emissiveParticleSpread }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uFreq;
        uniform float uAmp;
        uniform float uSpeed;
        uniform float uBaseSize;
        uniform float uEdge;
        uniform float uLifespan;
        uniform float uWaviness;
        uniform float uParticleSpeed;
        uniform vec3 uParticleDir;
        uniform float uParticleSpread;

        attribute vec3 aNormal;
        attribute vec3 aRandom;

        varying float vAlpha;

        ${simplexNoiseGLSL}

        void main() {
          vec3 pos = position;
          
          // Compute individual cycle progress based on configurable lifespan
          float individualLifespan = uLifespan * (0.5 + aRandom.y * 1.0);
          float speedFactor = 1.0 / max(0.05, individualLifespan);
          float progress = fract(uTime * speedFactor + aRandom.x * 12.34);

          // Calculate particle's exact birth time in the past
          float age = progress * individualLifespan;
          float birthTime = uTime - age;

          // Dissolve oscillator threshold at birth time (with fully-formed holding state)
          float waveAtBirth = sin(birthTime * uSpeed * 0.2);
          float thresholdAtBirth = max(0.0, waveAtBirth * 0.55 + 0.35);

          // Hide particles if fully formed holding state
          if (thresholdAtBirth < 0.01) {
            vAlpha = 0.0;
            gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
            gl_PointSize = 0.0;
            return;
          }

          // Compute Simplex Noise matching mesh surface position at birth time
          float noiseVal = snoise(pos * uFreq + vec3(0.0, birthTime * uSpeed * 0.1, 0.0));
          noiseVal = noiseVal * 0.5 + 0.5;

          // Check how close the particle's birth position was to the burning edge
          float edgeDist = abs(noiseVal - thresholdAtBirth);
          
          // Smooth spawn mask: 1.0 at edge, fading to 0.0 as it gets further
          float spawnMask = smoothstep(uEdge * 0.25, 0.0, edgeDist);

          // Hide particles that were not born on the active burning edge
          if (spawnMask < 0.01) {
            vAlpha = 0.0;
            gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
            gl_PointSize = 0.0;
            return;
          }

          // Compute 3D curl velocity for beautiful starry turbulence at the border
          vec3 curl = vec3(
            sin(pos.y * 3.0 + uTime * 2.0) * cos(pos.z * 3.0),
            sin(pos.z * 3.0 + uTime * 2.0) * cos(pos.x * 3.0),
            sin(pos.x * 3.0 + uTime * 2.0) * cos(pos.y * 3.0)
          ) * 0.4;

          // Beautiful wavy oscillating motion (sine/cosine waves on orthogonal directions)
          // Scales with uWaviness and progresses over the lifetime
          float angle = progress * 15.0 + aRandom.x * 6.28;
          vec3 wavyOffset = vec3(
            sin(angle) * (1.0 + aRandom.y * 1.5),
            cos(angle * 0.7) * (1.0 + aRandom.z * 1.5),
            sin(angle * 1.3) * 0.5
          ) * uWaviness * 0.8;

          // Expand along normal and drift upwards smoothly with wavy offset
          vec3 baseSpread = aNormal * (1.5 + aRandom.y * 2.0) * uParticleSpread;
          vec3 flightDir = uParticleDir + baseSpread + curl * (0.5 + aRandom.z * 0.5) + wavyOffset;
          
          float displacement = progress * uAmp * (0.8 + aRandom.y * 1.0) * uParticleSpeed;
          pos += flightDir * displacement * 0.05;

          // Beautiful fade-in fade-out curve based on life progress
          vAlpha = sin(progress * 3.14159) * (1.0 - progress * 0.2) * spawnMask;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Size reduces over lifetime and varies by random factor
          gl_PointSize = uBaseSize * (1.0 / -mvPosition.z) * (1.0 - progress * 0.5) * (0.5 + aRandom.z * 0.8);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform sampler2D uTexture;
        varying float vAlpha;

        void main() {
          vec4 texColor = texture2D(uTexture, gl_PointCoord);
          
          // Calculate high-quality 4-point star as a fail-safe fallback
          vec2 p = gl_PointCoord - 0.5;
          float xGlow = exp(-abs(p.x) * 30.0) * exp(-abs(p.y) * 5.0);
          float yGlow = exp(-abs(p.y) * 30.0) * exp(-abs(p.x) * 5.0);
          float core = exp(-length(p) * 20.0);
          float star = clamp(xGlow + yGlow + core, 0.0, 1.0);
          // Apply boundary falloff
          star *= smoothstep(0.5, 0.2, length(p));
          
          // Use texture alpha and colors if texture loaded successfully and has opacity,
          // otherwise fallback to the 4-point star glow representation.
          float alphaMask = texColor.a > 0.05 ? texColor.a : star;
          vec3 finalColor = texColor.a > 0.05 ? (uColor * 4.0 * texColor.rgb) : (uColor * 4.0 * vec3(star));
          
          if (alphaMask < 0.01) discard;
          
          gl_FragColor = vec4(finalColor, vAlpha * alphaMask);
        }
      `
    });

    const particles = new THREE.Points(particleGeometry, particlesMaterial);
    scene.add(particles);

    // Apply Post Processing bloom for that hot glowing emissive effect!
    const renderPass = new RenderPass(scene, camera);
    renderPass.clearColor = new THREE.Color(0, 0, 0);
    renderPass.clearAlpha = 0;
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 
      emissiveBloom, 
      emissiveBloomRadius, 
      1.1 // Forced threshold to stop mesh base from blooming
    );
    bloomPass.threshold = 1.1;

    const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    });
    const composer = new EffectComposer(renderer, renderTarget);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    const bgPass = new ShaderPass(CustomBackgroundShader);
    bgPass.uniforms.uBgTexture.value = bgTexture;
    bgPass.uniforms.uHasBg.value = bgTexture !== null;
    composer.addPass(bgPass);

    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      const elapsedTime = clock.getElapsedTime();
      
      if (bgTexture && bgTexture.image) {
        adjustTextureOffset(bgTexture, window.innerWidth, window.innerHeight, meshMaterial.uniforms, bgPass.uniforms);
      }
      
      // Update dynamic uniform updates from settings reactively via ref checks
      const currentSettings = settingsRef.current;
      const speedMult = currentSettings?.emissiveSpeed ?? 1.0;
      const freqVal = currentSettings?.emissiveFrequency ?? 0.25;
      const ampVal = currentSettings?.emissiveAmplitude ?? 16.0;
      const edgeVal = currentSettings?.emissiveEdgeWidth ?? 0.8;
      const bloomVal = currentSettings?.emissiveBloom ?? 8.0;
      const bloomThresholdVal = currentSettings?.emissiveBloomThreshold ?? 0.15;
      const bloomRadiusVal = currentSettings?.emissiveBloomRadius ?? 0.4;
      const partSizeVal = currentSettings?.emissiveParticleSize ?? 80;
      const lifespanVal = currentSettings?.emissiveParticleLifespan ?? 1.5;
      const wavinessVal = currentSettings?.emissiveWaviness ?? 1.0;
      const particleSpeedVal = currentSettings?.emissiveParticleSpeed ?? 1.0;
      const particleDirXVal = currentSettings?.emissiveParticleDirectionX ?? 0.0;
      const particleDirYVal = currentSettings?.emissiveParticleDirectionY ?? 1.5;
      const particleDirZVal = currentSettings?.emissiveParticleDirectionZ ?? 0.0;
      const particleSpreadVal = currentSettings?.emissiveParticleSpread ?? 1.5;
      const latestColorHex = currentSettings?.colors?.[0] || '#4d9bff';

      const updateColor = new THREE.Color(latestColorHex);

      // Rotate torus knot slightly over time
      mesh.rotation.y = elapsedTime * 0.15 * speedMult;
      mesh.rotation.x = elapsedTime * 0.08 * speedMult;

      // Rotate particles in perfect lockstep so they align with the dissolving edges
      particles.rotation.y = mesh.rotation.y;
      particles.rotation.x = mesh.rotation.x;

      // Update uniforms inside shaders
      meshMaterial.uniforms.uTime.value = elapsedTime;
      meshMaterial.uniforms.uDissolveColor.value.copy(updateColor);
      meshMaterial.uniforms.uFreq.value = freqVal;
      meshMaterial.uniforms.uAmp.value = ampVal;
      meshMaterial.uniforms.uEdge.value = edgeVal;
      meshMaterial.uniforms.uSpeed.value = speedMult;

      particlesMaterial.uniforms.uTime.value = elapsedTime;
      particlesMaterial.uniforms.uColor.value.copy(updateColor);
      particlesMaterial.uniforms.uFreq.value = freqVal;
      particlesMaterial.uniforms.uAmp.value = ampVal;
      particlesMaterial.uniforms.uEdge.value = edgeVal;
      particlesMaterial.uniforms.uSpeed.value = speedMult;
      particlesMaterial.uniforms.uBaseSize.value = partSizeVal;
      particlesMaterial.uniforms.uLifespan.value = lifespanVal;
      particlesMaterial.uniforms.uWaviness.value = wavinessVal;
      particlesMaterial.uniforms.uParticleSpeed.value = particleSpeedVal;
      particlesMaterial.uniforms.uParticleDir.value.set(particleDirXVal, particleDirYVal, particleDirZVal);
      particlesMaterial.uniforms.uParticleSpread.value = particleSpreadVal;

      bloomPass.strength = bloomVal;
      bloomPass.threshold = 1.1;
      bloomPass.radius = bloomRadiusVal;

      bgPass.uniforms.uBgTexture.value = bgTexture;
      bgPass.uniforms.uHasBg.value = bgTexture !== null;

      controls.update();

      if (performanceMode) {
        renderer.render(scene, camera);
      } else {
        composer.render();
      }
    };

    animate();

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.fov = getAdjustedFov(width, height, 48);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
      bloomPass.setSize(width, height);
      meshMaterial.uniforms.uResolution.value.set(width, height);
    };

    window.addEventListener('resize', handleResize);

    const containerElement = containerRef.current;

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      
      // Clean up WebGL resources cleanly
      geometry.dispose();
      meshMaterial.dispose();
      tempTorusGeometry.dispose();
      particleGeometry.dispose();
      particlesMaterial.dispose();
      renderer.dispose();
      controls.dispose();

      if (containerElement && renderer.domElement) {
        if (containerElement.contains(renderer.domElement)) {
          containerElement.removeChild(renderer.domElement);
        }
      }
      
      if (bgTexture) {
        bgTexture.dispose();
      }
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
      }
    };
  }, [performanceMode, settings?.emissiveShape, settings?.emissiveParticleCount, settings?.emissiveCustomBackground, settings?.emissiveCustomBackgroundType]);

  return (
    <div className="fixed inset-0 w-full h-full -z-10 bg-[#020205] overflow-hidden">
      {settings?.emissiveCustomBackground && settings?.emissiveCustomBackgroundType === 'image' && (
        <img
          src={settings.emissiveCustomBackground}
          alt="Custom Emissive Background"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          referrerPolicy="no-referrer"
        />
      )}
      {settings?.emissiveCustomBackground && settings?.emissiveCustomBackgroundType === 'video' && (
        <video
          src={settings.emissiveCustomBackground}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      )}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-10" />
    </div>
  );
};
