"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    THREE: any
  }
}

export function ShaderAnimation() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    camera: unknown
    scene: unknown
    renderer: unknown
    uniforms: unknown
    animationId: number | null
    cleanup?: () => void
  }>({
    camera: null,
    scene: null,
    renderer: null,
    uniforms: null,
    animationId: null,
  })

  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/89/three.min.js"
    script.onload = () => {
      if (containerRef.current && window.THREE) {
        initThreeJS()
      }
    }
    document.head.appendChild(script)

    return () => {
      if (sceneRef.current.animationId) {
        cancelAnimationFrame(sceneRef.current.animationId)
      }
      sceneRef.current.cleanup?.()
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [])

  const initThreeJS = () => {
    if (!containerRef.current || !window.THREE) return

    const THREE = window.THREE as Record<string, unknown>
    const container = containerRef.current
    container.innerHTML = ""

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const CameraClass = THREE.Camera as any
    const SceneClass = THREE.Scene as any
    const PlaneClass = THREE.PlaneBufferGeometry as any
    const Vector2Class = THREE.Vector2 as any
    const ShaderClass = THREE.ShaderMaterial as any
    const MeshClass = THREE.Mesh as any
    const RendererClass = THREE.WebGLRenderer as any

    const camera = new CameraClass()
    camera.position.z = 1
    const scene = new SceneClass()
    const geometry = new PlaneClass(2, 2)

    const uniforms = {
      time: { type: "f", value: 1.0 },
      resolution: { type: "v2", value: new Vector2Class() },
    }

    const vertexShader = `void main() { gl_Position = vec4(position, 1.0); }`

    // Glowing warm light particles on dark red
    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;

      float random(in float x) { return fract(sin(x)*1e4); }

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);

        vec2 fMosaicScal = vec2(4.0, 2.0);
        vec2 vScreenSize = vec2(256.0, 256.0);
        uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);
        uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);

        float t = time * 0.06 + random(uv.x) * 0.4;
        float lineWidth = 0.0012;

        vec3 color = vec3(0.0);
        for(int j = 0; j < 3; j++){
          for(int i = 0; i < 5; i++){
            color[j] += lineWidth * float(i*i) / abs(fract(t - 0.01*float(j) + float(i)*0.01) * 1.0 - length(uv));
          }
        }

        // Bright glowing embers: warm orange-red glow with hot white cores
        float intensity = (color.r + color.g + color.b) / 3.0;
        vec3 warmGlow = vec3(
          intensity * 1.8 + color.r * 0.6,
          intensity * 0.5 + color.g * 0.25,
          intensity * 0.15
        );

        // Add hot white/yellow core where light is brightest
        float hotness = smoothstep(0.3, 1.5, intensity);
        warmGlow += vec3(hotness * 0.8, hotness * 0.6, hotness * 0.2);

        gl_FragColor = vec4(warmGlow, 1.0);
      }
    `

    const material = new ShaderClass({ uniforms, vertexShader, fragmentShader })
    const mesh = new MeshClass(geometry, material)
    scene.add(mesh)

    const renderer = new RendererClass({ alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)

    const onWindowResize = () => {
      const rect = container.getBoundingClientRect()
      renderer.setSize(rect.width, rect.height)
      uniforms.resolution.value.x = renderer.domElement.width
      uniforms.resolution.value.y = renderer.domElement.height
    }
    onWindowResize()
    window.addEventListener("resize", onWindowResize)

    const animate = () => {
      sceneRef.current.animationId = requestAnimationFrame(animate)
      uniforms.time.value += 0.05
      renderer.render(scene, camera)
    }
    animate()

    sceneRef.current = {
      camera, scene, renderer, uniforms, animationId: null,
      cleanup: () => {
        window.removeEventListener("resize", onWindowResize)
        renderer.dispose()
      },
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  return <div ref={containerRef} className="w-full h-full absolute inset-0" />
}
