import { ProfileView } from "@/components/ProfileView";

export const metadata = { title: "Profile · Luckline" };

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <ProfileView />
    </div>
  );
}
