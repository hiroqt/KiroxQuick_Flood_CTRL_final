import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { cityPieces, project } from './mapGeometry';

interface Props {
  assembling: boolean;
  onComplete: () => void;
}

export function NcrScene({ assembling, onComplete }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const assemble = useRef(false);
  const done = useRef(onComplete);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    assemble.current = assembling;
  }, [assembling]);
  useEffect(() => {
    done.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-7, 7, 7, -7, 0.1, 100);
    camera.position.set(0, 0, 20);
    const world = new THREE.Group();
    world.rotation.set(-0.38, 0.12, -0.12);
    scene.add(world);
    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const light = new THREE.DirectionalLight(0xffffff, 1.7);
    light.position.set(-5, 7, 12);
    scene.add(light);
    const pieces = cityPieces.map((city, index) => {
      const group = new THREE.Group();
      const [cx, cy] = city.center;
      for (const polygon of city.polygons) {
        const shape = new THREE.Shape(
          polygon[0].map(([x, y]) => new THREE.Vector2(x - cx, y - cy)),
        );
        polygon
          .slice(1)
          .forEach((ring) =>
            shape.holes.push(
              new THREE.Path(ring.map(([x, y]) => new THREE.Vector2(x - cx, y - cy))),
            ),
          );
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: 0.19,
          bevelEnabled: false,
          steps: 1,
        });
        group.add(
          new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color: city.color, roughness: 1, flatShading: true }),
          ),
        );
        const points = polygon[0].map(([x, y]) => new THREE.Vector3(x - cx, y - cy, 0.205));
        group.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: '#f5f5e9' }),
          ),
        );
      }
      // Small architectural blocks give the administrative map a physical scale.
      for (let b = 0; b < 7; b++) {
        const height = 0.12 + ((index * 7 + b * 3) % 5) * 0.055;
        const building = new THREE.Mesh(
          new THREE.BoxGeometry(0.065, 0.09, height),
          new THREE.MeshStandardMaterial({ color: '#eeeee2', roughness: 1 }),
        );
        building.position.set(
          ((b % 3) - 1) * 0.13,
          (Math.floor(b / 3) - 1) * 0.14,
          0.19 + height / 2,
        );
        group.add(building);
      }
      const angle = index * 2.399;
      const preview = new THREE.Vector3(cx * 1.06, cy * 1.06, (index % 3) * 0.08);
      const scattered = new THREE.Vector3(Math.cos(angle) * 20, Math.sin(angle) * 16, index % 4);
      group.position.copy(preview);
      world.add(group);
      return { group, preview, scattered, target: new THREE.Vector3(cx, cy, 0), angle };
    });
    // An illustrative route, deliberately separate from the site's actual routing data.
    const routePoints = [
      [121.045, 14.685],
      [121.036, 14.66],
      [121.053, 14.632],
      [121.037, 14.611],
      [121.02, 14.586],
      [121.01, 14.554],
    ];
    const curve = new THREE.CatmullRomCurve3(
      routePoints.map((point) => {
        const [x, y] = project(point);
        return new THREE.Vector3(x, y, 0.3);
      }),
    );
    const route = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, 0.025, 6, false),
      new THREE.MeshBasicMaterial({ color: '#e96c3b' }),
    );
    world.add(route);
    const traveler = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#213e33' }),
    );
    world.add(traveler);
    const grid = new THREE.GridHelper(22, 35, '#c7cdbd', '#d9decf');
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.12;
    world.add(grid);
    const resize = () => {
      const width = container.clientWidth,
        height = container.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      const halfHeight = aspect < 0.85 ? 6.8 : 6;
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    let frame = 0,
      start = 0,
      completed = false;
    const pointer = { x: 0, y: 0 };
    const move = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / rect.width - 0.5;
      pointer.y = (event.clientY - rect.top) / rect.height - 0.5;
    };
    const leave = () => {
      pointer.x = 0;
      pointer.y = 0;
    };
    container.addEventListener('pointermove', move);
    container.addEventListener('pointerleave', leave);
    const draw = (time: number) => {
      if (assemble.current) {
        if (!start) start = time;
        const elapsed = time - start;
        pieces.forEach(({ group, target, scattered, angle }, index) => {
          const t = reduced ? 1 : THREE.MathUtils.clamp((elapsed - index * 28) / 1100, 0, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          group.position.lerpVectors(scattered, target, eased);
          group.rotation.z = angle * 0.16 * (1 - eased);
        });
        route.visible = elapsed > 1400;
        traveler.visible = route.visible;
        if (!completed && elapsed > (reduced ? 100 : 2050)) {
          completed = true;
          done.current();
        }
      } else {
        world.rotation.y += (0.12 + (reduced ? 0 : pointer.x * 0.16) - world.rotation.y) * 0.04;
        world.rotation.x += (-0.38 + (reduced ? 0 : pointer.y * 0.1) - world.rotation.x) * 0.04;
      }
      traveler.position.copy(curve.getPointAt(reduced ? 0.45 : (time % 10000) / 10000));
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    setReady(true);
    const lost = (event: Event) => {
      event.preventDefault();
      setReady(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      container.removeEventListener('pointermove', move);
      container.removeEventListener('pointerleave', leave);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // A real-boundary fallback also serves slow devices and WebGL context loss.
  return (
    <div ref={host} className="absolute inset-0" aria-hidden="true">
      {!ready && (
        <svg viewBox="-6 -6 12 12" className="h-full w-full" style={{ transform: 'scaleY(-1)' }}>
          {cityPieces.map((city, index) => (
            <g
              key={city.name}
              className={assembling ? 'landing-fallback-piece' : undefined}
              style={
                {
                  '--piece-x': `${Math.cos(index * 2.399) * 900}px`,
                  '--piece-y': `${Math.sin(index * 2.399) * 700}px`,
                  animationDelay: `${index * 28}ms`,
                } as React.CSSProperties
              }
            >
              {city.polygons.map((polygon, i) => (
                <path
                  key={i}
                  d={polygon
                    .map((ring) => `M${ring.map(([x, y]) => `${x},${y}`).join('L')}Z`)
                    .join('')}
                  fill={city.color}
                  stroke="#f5f5e9"
                  strokeWidth="0.025"
                  fillRule="evenodd"
                />
              ))}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
