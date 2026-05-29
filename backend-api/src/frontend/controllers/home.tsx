import { redirect } from "next/navigation";

export default function HomeController() {
  redirect("/admin/login");
}
