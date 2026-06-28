import { Facebook, Twitter, Instagram } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-white text-gray-600 py-12 border-t border-gray-200">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          <FooterSection title={t("footer.internship_places")} items={["New York", "Los Angeles", "Chicago", "San Francisco", "Miami", "Seattle"]} />
          <FooterSection title={t("footer.internship_stream")} items={["About us", "Careers", "Press", "News", "Media kit", "Contact"]} />
          <FooterSection title={t("footer.job_places")} items={["Blog", "Newsletter", "Events", "Help center", "Tutorials", "Supports"]} links />
          <FooterSection title={t("footer.job_streams")} items={["Startups", "Enterprise", "Government", "SaaS", "Marketplaces", "Ecommerce"]} links />
        </div>

        <hr className="my-10 border-gray-200" />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          <FooterSection title={t("footer.about_us")} items={["Startups", "Enterprise"]} links />
          <FooterSection title={t("footer.team_diary")} items={["Startups", "Enterprise"]} links />
          <FooterSection title={t("footer.terms")} items={["Startups", "Enterprise"]} links />
          <FooterSection title={t("footer.sitemap")} items={["Startups"]} links />
        </div>

        <div className="mt-10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-50 text-gray-700 transition">
            <i className="bi bi-google-play"></i> {t("footer.get_android")}
          </p>
          <div className="flex space-x-4 mt-4 sm:mt-0">
            <Facebook className="w-6 h-6 text-gray-500 hover:text-blue-600 cursor-pointer transition" />
            <Twitter className="w-6 h-6 text-gray-500 hover:text-blue-600 cursor-pointer transition" />
            <Instagram className="w-6 h-6 text-gray-500 hover:text-blue-600 cursor-pointer transition" />
          </div>
          <p className="mt-4 sm:mt-0 text-sm text-gray-400">© Copyright 2025. {t("footer.rights_reserved")}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterSection({ title, items, links }:any) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">{title}</h3>
      <div className="flex flex-col items-start mt-4 space-y-3">
        {items.map((item:any, index:any) =>
          links ? (
            <a key={index} href="/" className="text-gray-600 hover:text-blue-600 hover:underline">
              {item}
            </a>
          ) : (
            <p key={index} className="text-gray-600 hover:text-blue-600 hover:underline cursor-pointer">
              {item}
            </p>
          )
        )}
      </div>
    </div>
  );
}