import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type SocialUser, type Standing, type UserProfile } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { FadeIn, Page } from "../components/Motion";
import { ProfileCard } from "../components/ProfileCard";
import { SkeletonCard } from "../components/Skeleton";

/** Public social profile — card only (no settings / private event lists). */
export function PublicProfilePage() {
  const { id } = useParams();
  const userId = Number(id);
  const { t } = useTranslation(["dashboard", "common"]);
  const { user: me } = useAuth();
  const [user, setUser] = useState<SocialUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isInteger(userId) || userId <= 0) {
      setError(t("profile.publicNotFound"));
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    api
      .getPublicProfile(userId)
      .then((d) => {
        if (!alive) return;
        setUser(d.user);
        setProfile(d.profile);
        setStanding(d.standing);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : t("profile.publicNotFound"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId, t]);

  if (me && Number.isInteger(userId) && me.id === userId) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <Page className="cc-dashboard-page">
      <section className="cc-section">
        <div className="sc-container cc-profile-page">
          <p className="cc-public-profile__back">
            <Link to="/leaderboard" className="sc-micro">
              <i className="ph ph-arrow-left" aria-hidden="true" /> {t("common:nav.leaderboard")}
            </Link>
          </p>

          {loading && <SkeletonCard />}
          {error && !loading && <div className="cc-alert cc-alert--error">{error}</div>}
          {!loading && !error && user && (
            <FadeIn>
              <ProfileCard user={user} standing={standing} profile={profile} editable={false} />
            </FadeIn>
          )}
        </div>
      </section>
    </Page>
  );
}
