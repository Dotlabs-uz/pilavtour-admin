'use client'

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
    const router = useRouter();
    useEffect(() => {
        router.push("/admin/users");
    }, [router]);
    return (
        <div>
            <h1>Home</h1>
        </div>
    )
}