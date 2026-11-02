import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  api,
  formatUserName,
  type Standing,
  type SocialUser,
  type UserProfile,
} from "../lib/api";
import { loadImageFromFile } from "../lib/avatar";
import { useToast } from "../hooks/useToast";
import { useIsPhone } from "../hooks/useIsPhone";
import { Avatar } from "./Avatar";
import { ImageCropModal, type CropMode } from "./ImageCropModal";
import { AchievementsModal } from "./AchievementsModal";

/**
 * Social-style profile card: cover artwork, square avatar with medal frame,
 * identity, meta chips, and stat counters. Achievements live in a separate
 * modal opened via the trophy button.
 *
 * `editable` controls owner-only actions. Pass `profile` for public views
 * (skips the authenticated profile fetch).
 */
export function ProfileCard({
  user,
  standing,
  editable = true,
  profile: profileProp,
}: {
  user: SocialUser;
  standing: Standing | null;
  editable?: boolean;
  profile?: UserProfile | null;
}) {
  const { t, i18n } = useTranslation(["dashboard", "common"]);
  const { toast } = useToast();
  const isPhone = useIsPhone();
  const [profile, setProfile] = useState<UserProfile | null>(profileProp ?? null);
  const [busy, setBusy] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const [crop, setCrop] = useState<{
    mode: CropMode;
    imageUrl: string;
    img: HTMLImageElement;
  } | null>(null);

  useEffect(() => {
    if (profileProp !== undefined) {
      setProfile(profileProp);
      return;
    }
    if (!editable) return;
    let alive = true;
    api
      .getProfile()
      .then((d) => {
        if (alive) setProfile(d.profile);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user.id, editable, profileProp]);

  useEffect(() => {
    return () => {
      if (crop?.imageUrl) URL.revokeObjectURL(crop.imageUrl);
    };
  }, [crop?.imageUrl]);

  const earned = new Set(profile?.achievements.map((a) => a.code) ?? []);
  const equipped = profile?.equippedFrame ?? user.equippedFrame ?? null;
  const avatarSrc = profile?.avatar ?? user.avatarUrl ?? null;
  const coverSrc = profile?.cover ?? profile?.defaultCoverUrl ?? profile?.defaultAvatarUrl ?? null;
  const isOrganizer = user.role === "coordinator" || user.role === "admin";

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(i18n.language, {
        month: "long",
        year: "numeric",
      })
    : null;

  const openCropper = async (file: File, mode: CropMode) => {
    try {
      const { img, objectUrl } = await loadImageFromFile(file);
      if (crop?.imageUrl) URL.revokeObjectURL(crop.imageUrl);
      setCrop({ mode, imageUrl: objectUrl, img });
    } catch (err) {
      toast(err instanceof Error ? err.message : t("profile.avatarFailed"), "error");
    }
  };

  const handleAvatarPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    void openCropper(file, "avatar");
  };

  const handleCoverPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    void openCropper(file, "cover");
  };

  const closeCrop = () => {
    if (crop?.imageUrl) URL.revokeObjectURL(crop.imageUrl);
    setCrop(null);
  };

  const handleCropConfirm = async (dataUrl: string) => {
    if (!crop || busy || !editable) return;
    setBusy(true);
    try {
      if (crop.mode === "avatar") {
        const d = await api.updateProfile({ avatar: dataUrl });
        setProfile(d.profile);
        toast(t("profile.avatarUpdated"), "success");
      } else {
        const d = await api.updateProfile({ cover: dataUrl });
        setProfile(d.profile);
        toast(t("profile.coverUpdated"), "success");
      }
      closeCrop();
    } catch (err) {
      toast(
        err instanceof Error
          ? err.message
          : crop.mode === "avatar"
            ? t("profile.avatarFailed")
            : t("profile.coverFailed"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEquip = async (frame: string, isEarned: boolean) => {
    if (!editable || !isEarned || busy) return;
    setBusy(true);
    try {
      const d = await api.updateProfile({ equippedFrame: equipped === frame ? null : frame });
      setProfile(d.profile);
    } catch (err) {
      toast(err instanceof Error ? err.message : t("profile.frameFailed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <article className="sc-card cc-profile-card">
        <div
          className="cc-profile-card__cover"
          style={coverSrc ? { backgroundImage: `url(${coverSrc})` } : undefined}
        >
          <div className="cc-profile-card__cover-actions">
            {editable && (
              <button
                type="button"
                className="cc-profile-card__icon-btn"
                disabled={busy}
                onClick={() => coverFileRef.current?.click()}
                title={t("profile.changeCover")}
                aria-label={t("profile.changeCover")}
              >
                <i className="ph ph-image" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="cc-profile-card__icon-btn"
              disabled={busy}
              onClick={() => setAchievementsOpen(true)}
              title={t("profile.achievementsTitle")}
              aria-label={t("profile.achievementsTitle")}
            >
              <i className="ph ph-trophy" aria-hidden="true" />
            </button>
            {editable && (
              <Link
                to="/settings"
                className="cc-profile-card__icon-btn"
                data-gibbo="settings-link"
                title={t("settings.link")}
                aria-label={t("settings.link")}
              >
                <i className="ph ph-gear" aria-hidden="true" />
              </Link>
            )}
            {editable && (
              <input
                ref={coverFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={handleCoverPick}
              />
            )}
          </div>
        </div>

        <div className="cc-profile-card__main">
          <div className="cc-profile-card__avatar-wrap">
            <Avatar
              src={avatarSrc}
              name={formatUserName(user)}
              frame={equipped}
              size={isPhone ? 116 : 180}
              className="cc-profile-card__avatar"
            />
            {editable && (
              <>
                <button
                  type="button"
                  className="cc-profile-card__avatar-edit"
                  disabled={busy}
                  onClick={() => avatarFileRef.current?.click()}
                  title={t("profile.changePhoto")}
                  aria-label={t("profile.changePhoto")}
                >
                  <i className="ph ph-camera" aria-hidden="true" />
                </button>
                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={handleAvatarPick}
                />
              </>
            )}
          </div>

          <div className="cc-profile-card__identity">
            <h1 className="cc-profile-card__name">{formatUserName(user)}</h1>
            <span className="cc-profile-card__username">@{user.username}</span>
            <div className="cc-profile-card__meta">
              {isOrganizer && (
                <span className="sc-chip sc-chip--primary cc-profile-card__meta-chip">
                  <i className="ph ph-star" aria-hidden="true" /> {t("profile.organizerBadge")}
                </span>
              )}
              {user.localLeagueCity && (
                <span className="cc-profile-card__meta-item">
                  <i className="ph ph-map-pin" aria-hidden="true" /> {user.localLeagueCity}
                </span>
              )}
              {memberSince && (
                <span className="cc-profile-card__meta-item">
                  <i className="ph ph-cake" aria-hidden="true" />{" "}
                  {t("profile.memberSince", { date: memberSince })}
                </span>
              )}
            </div>
          </div>

          <div className="cc-profile-card__stats" data-gibbo="standings">
            <Link to="/leaderboard" className="cc-profile-card__stat cc-profile-card__stat--main">
              <strong>{standing?.points ?? 0}</strong>
              <span>{t("profile.stats.points")}</span>
            </Link>
            <div className="cc-profile-card__stat">
              <strong>{standing?.wins ?? 0}</strong>
              <span>{t("profile.stats.wins")}</span>
            </div>
            <div className="cc-profile-card__stat">
              <strong>{standing?.losses ?? 0}</strong>
              <span>{t("profile.stats.losses")}</span>
            </div>
            <div className="cc-profile-card__stat">
              <strong>{standing?.draws ?? 0}</strong>
              <span>{t("profile.stats.draws")}</span>
            </div>
            <div className="cc-profile-card__stat">
              <strong>{standing?.eventsPlayed ?? 0}</strong>
              <span>{t("profile.stats.events")}</span>
            </div>
          </div>
        </div>
      </article>

      <AchievementsModal
        open={achievementsOpen}
        earnedCodes={earned}
        equippedFrame={equipped}
        busy={busy}
        readOnly={!editable}
        onEquip={(frame, isEarned) => void handleEquip(frame, isEarned)}
        onClose={() => setAchievementsOpen(false)}
      />

      {crop && editable && (
        <ImageCropModal
          open
          mode={crop.mode}
          imageUrl={crop.imageUrl}
          img={crop.img}
          frame={equipped}
          busy={busy}
          onCancel={closeCrop}
          onConfirm={(dataUrl) => void handleCropConfirm(dataUrl)}
        />
      )}
    </>
  );
}
