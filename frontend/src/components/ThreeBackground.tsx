import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Primary icosahedron — large, lower-right
    const geo1 = new THREE.IcosahedronGeometry(2.4, 1);
    const wire1 = new THREE.WireframeGeometry(geo1);
    const mat1 = new THREE.LineBasicMaterial({
      color: 0x25d366,
      opacity: 0.13,
      transparent: true,
    });
    const mesh1 = new THREE.LineSegments(wire1, mat1);
    mesh1.position.set(3.2, -0.6, -1.5);
    scene.add(mesh1);

    // Secondary icosahedron — smaller, upper-left
    const geo2 = new THREE.IcosahedronGeometry(1.2, 1);
    const wire2 = new THREE.WireframeGeometry(geo2);
    const mat2 = new THREE.LineBasicMaterial({
      color: 0x25d366,
      opacity: 0.07,
      transparent: true,
    });
    const mesh2 = new THREE.LineSegments(wire2, mat2);
    mesh2.position.set(-3.4, 1.4, -2.5);
    scene.add(mesh2);

    // Mouse influence
    let mx = 0, my = 0;
    const onMouseMove = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    let raf: number;
    const animate = () => {
      mesh1.rotation.x += 0.0014 + my * 0.0004;
      mesh1.rotation.y += 0.003 + mx * 0.0005;
      mesh2.rotation.x -= 0.001;
      mesh2.rotation.y += 0.0018;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geo1.dispose();
      wire1.dispose();
      mat1.dispose();
      geo2.dispose();
      wire2.dispose();
      mat2.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
}
