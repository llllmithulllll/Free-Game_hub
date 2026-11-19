import { auth, db } from "@/lib/firebase";
import { ACCENT_THEMES, createThemedStyles, themeColors, useAppTheme, useThemedAlert } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import GamingBackdrop from "@/components/GamingBackdrop";
import ProfileAvatar from "@/components/ProfileAvatar";
import { useFocusEffect, useRouter } from "expo-router";

import {
  signOut,
  updateEmail,
  updatePassword,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import React, { useCallback, useEffect, useState } from "react";
import { ageFromDateOfBirth, dateOfBirthFromStorage } from "@/lib/content-filter";
import Animated, { FadeInUp, ReduceMotion } from "react-native-reanimated";

import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";

// ============================================================
// PREFERENCE OPTIONS
// ============================================================

const CATEGORIES = [
  "Action",
  "Shooter",
  "MMORPG",
  "Racing",
  "Sports",
  "Strategy",
];

// ============================================================
// PROFILE
// ============================================================

export default function Profile() {
  const { mode, accentTheme, colors } = useAppTheme();
  const showAlert = useThemedAlert();
  const router = useRouter();
  const modeLabel = mode === "system" ? "Auto" : mode === "light" ? "Light" : "Dark";

  // ==========================================================
  // GAME COLLECTIONS
  // ==========================================================

  const [backlog, setBacklog] = useState<any[]>([]);
  const [playing, setPlaying] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  const [claimed, setClaimed] = useState<any[]>([]);

  // ==========================================================
  // COLLAPSIBLE SECTIONS
  // ==========================================================

  // ==========================================================
  // PROFILE
  // ==========================================================

  const [userName, setUserName] = useState(
    auth.currentUser?.displayName || "Gamer"
  );
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);


  // ==========================================================
  // PREFERENCES
  // ==========================================================

  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [tempSelectedCats, setTempSelectedCats] = useState<string[]>([]);

  const [preferencesVisible, setPreferencesVisible] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [sexualContentFilter, setSexualContentFilter] = useState(true);
  const isUnder18OrUnknown = !dateOfBirth || (ageFromDateOfBirth(dateOfBirth) ?? 0) < 18;

  useFocusEffect(useCallback(() => {
    const user = auth.currentUser;
    if (!user) return;
    Promise.all([
      getDoc(doc(db, "users", user.uid)),
      getDoc(doc(db, "users", user.uid, "preferences", "data")),
      getDoc(doc(db, "publicProfiles", user.uid)),
    ]).then(([snapshot, preferences, publicProfile]) => {
      const data = snapshot.exists() ? snapshot.data() : {};
      const publicData = publicProfile.exists() ? publicProfile.data() : {};
      setUserName(data.displayName || user.displayName || "Gamer");
      setAvatarPreviewUrl(publicData.avatarPreviewUrl || publicData.avatarUrl || null);
      setAvatarId(publicData.avatarId || null);
      setDateOfBirth(dateOfBirthFromStorage(data.dateOfBirth) || null);
      setSexualContentFilter(preferences.exists() ? preferences.data().sexualContentFilter !== false : true);
    }).catch((error) => console.error("Profile refresh failed:", error));
  }, []));

  // ==========================================================
  // ACCOUNT SETTINGS
  // ==========================================================

  const [accountSettingsVisible, setAccountSettingsVisible] =
    useState(false);

  const [newEmail, setNewEmail] = useState(
    auth.currentUser?.email || ""
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    // ========================================================
    // LOAD PREFERENCES
    // ========================================================

    const loadPreferences = async () => {
      try {
        setLoadingPreferences(true);

        const snap = await getDoc(
          doc(
            db,
            "users",
            user.uid,
            "preferences",
            "data"
          )
        );

        if (snap.exists()) {
          const categories =
            snap.data().categories || [];

          setSelectedCats(categories);
          setTempSelectedCats(categories);
          setSexualContentFilter(snap.data().sexualContentFilter !== false);
        }

        const profileSnap = await getDoc(doc(db, "users", user.uid));
        const profileData = profileSnap.exists() ? profileSnap.data() : {};
        const dob = profileData.dateOfBirth;
        setDateOfBirth(dateOfBirthFromStorage(dob) || null);
        setUserName(profileData.displayName || user.displayName || "Gamer");
      } catch (error) {
        console.error(
          "Preference Load Error:",
          error
        );
      } finally {
        setLoadingPreferences(false);
      }
    };

    loadPreferences();

    // ========================================================
    // GAME STATUS LISTENERS
    // ========================================================

    const baseQuery = collection(
      db,
      "users",
      user.uid,
      "gameStatus"
    );

    // CLAIMED

    const unsubClaimed = onSnapshot(
      query(
        baseQuery,
        where("status", "==", "Claimed")
      ),
      (snapshot) =>
        setClaimed(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          }))
        )
    );

    // PLAYING

    const unsubPlaying = onSnapshot(
      query(
        baseQuery,
        where("status", "==", "Playing")
      ),
      (snapshot) =>
        setPlaying(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          }))
        )
    );

    // COMPLETED

    const unsubCompleted = onSnapshot(
      query(
        baseQuery,
        where("status", "==", "Completed")
      ),
      (snapshot) =>
        setCompleted(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          }))
        )
    );

    // BACKLOG

    const unsubBacklog = onSnapshot(
      query(
        baseQuery,
        where("status", "==", "To Play")
      ),
      (snapshot) =>
        setBacklog(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          }))
        )
    );

    // CLEANUP

    return () => {
      unsubClaimed();
      unsubPlaying();
      unsubCompleted();
      unsubBacklog();
    };
  }, []);

  // ==========================================================
  // UPDATE DISPLAY NAME
  // ==========================================================

  // ==========================================================
  // UPDATE EMAIL
  // ==========================================================

  const handleUpdateEmail = async () => {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    const email =
      newEmail.trim();

    if (!email) {
      showAlert(
        "Invalid Email",
        "Please enter an email address."
      );

      return;
    }

    if (
      email ===
      user.email
    ) {
      showAlert(
        "No Changes",
        "This is already your current email address."
      );

      return;
    }

    try {
      setUpdatingEmail(true);

      await updateEmail(
        user,
        email
      );

      // Sync Firestore user document

      await setDoc(
        doc(
          db,
          "users",
          user.uid
        ),
        {
          email,
          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      showAlert(
        "Email Updated",
        "Your email address has been updated."
      );
    } catch (error: any) {
      console.error(
        "Email Update Error:",
        error
      );

      if (
        error?.code ===
        "auth/requires-recent-login"
      ) {
        showAlert(
          "Sign In Again",
          "For security, please log out and sign in again before changing your email."
        );

        return;
      }

      if (
        error?.code ===
        "auth/email-already-in-use"
      ) {
        showAlert(
          "Email Already Used",
          "Another account is already using this email."
        );

        return;
      }

      if (
        error?.code ===
        "auth/invalid-email"
      ) {
        showAlert(
          "Invalid Email",
          "Please enter a valid email address."
        );

        return;
      }

      showAlert(
        "Error",
        error?.message ||
          "Failed to update email."
      );
    } finally {
      setUpdatingEmail(false);
    }
  };

  // ==========================================================
  // UPDATE PASSWORD
  // ==========================================================

  const handleUpdatePassword = async () => {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    if (
      newPassword.length < 6
    ) {
      showAlert(
        "Password Too Short",
        "Your password must contain at least 6 characters."
      );

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      showAlert(
        "Passwords Don't Match",
        "Please make sure both passwords are the same."
      );

      return;
    }

    try {
      setUpdatingPassword(true);

      await updatePassword(
        user,
        newPassword
      );

      setNewPassword("");
      setConfirmPassword("");

      showAlert(
        "Password Updated",
        "Your password has been changed successfully."
      );
    } catch (error: any) {
      console.error(
        "Password Update Error:",
        error
      );

      if (
        error?.code ===
        "auth/requires-recent-login"
      ) {
        showAlert(
          "Sign In Again",
          "For security, please log out and sign in again before changing your password."
        );

        return;
      }

      if (
        error?.code ===
        "auth/weak-password"
      ) {
        showAlert(
          "Weak Password",
          "Please choose a stronger password."
        );

        return;
      }

      showAlert(
        "Error",
        error?.message ||
          "Failed to update password."
      );
    } finally {
      setUpdatingPassword(false);
    }
  };

  // ==========================================================
  // OPEN ACCOUNT SETTINGS
  // ==========================================================

  const openAccountSettings = () => {
    setNewEmail(
      auth.currentUser?.email ||
        ""
    );

    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);

    setAccountSettingsVisible(true);
  };

  // ==========================================================
  // OPEN PREFERENCES
  // ==========================================================

  const openPreferenceEditor = () => {
    setTempSelectedCats([
      ...selectedCats,
    ]);

    setPreferencesVisible(true);
  };

  // ==========================================================
  // TOGGLE PREFERENCE
  // ==========================================================

  const togglePreference = (
    category: string
  ) => {
    const lower =
      category.toLowerCase();

    setTempSelectedCats(
      (previous) =>
        previous.includes(lower)
          ? previous.filter(
              (item) =>
                item !== lower
            )
          : [
              ...previous,
              lower,
            ]
    );
  };

  // ==========================================================
  // SAVE PREFERENCES
  // ==========================================================

  const handleSavePreferences =
    async () => {
      const user =
        auth.currentUser;

      if (!user) {
        return;
      }

      try {
        setSavingPreferences(
          true
        );

        await setDoc(
          doc(
            db,
            "users",
            user.uid,
            "preferences",
            "data"
          ),

          {
            categories:
              tempSelectedCats,

            sexualContentFilter,

            updatedAt:
              serverTimestamp(),
          },

          {
            merge: true,
          }
        );

        setSelectedCats(
          tempSelectedCats
        );

        setPreferencesVisible(
          false
        );

        showAlert(
          "Preferences Updated",
          "Your game preferences have been saved."
        );
      } catch (error) {
        console.error(
          "Preference Save Error:",
          error
        );

        showAlert(
          "Error",
          "Failed to update preferences."
        );
      } finally {
        setSavingPreferences(
          false
        );
      }
    };

  const handleToggleSexualContentFilter = async (enabled: boolean) => {
    const user = auth.currentUser;
    if (!user || (isUnder18OrUnknown && !enabled)) return;
    const nextValue = isUnder18OrUnknown ? true : enabled;
    setSexualContentFilter(nextValue);
    try {
      await setDoc(
        doc(db, "users", user.uid, "preferences", "data"),
        { categories: selectedCats, sexualContentFilter: nextValue, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch {
      setSexualContentFilter(!nextValue);
      showAlert("Error", "Could not update content filtering.");
    }
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {
    showAlert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log Out",
          style: "destructive",

          onPress: async () => {
            try {
              await signOut(auth);

              router.replace(
                "/login"
              );
            } catch (error) {
              showAlert(
                "Error",
                "Failed to log out."
              );
            }
          },
        },
      ]
    );
  };

  // ==========================================================
  // STATS
  // ==========================================================

  const totalGames =
    claimed.length +
    playing.length +
    completed.length +
    backlog.length;

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <>
      <ScrollView
        style={[styles.container, Platform.OS === "web" && { width: "100%", maxWidth: 1080, alignSelf: "center" }]}
        showsVerticalScrollIndicator={
          false
        }
      >
        <GamingBackdrop />
        {/* PROFILE HEADER */}

        <View
          style={
            styles.header
          }
        >
          <ProfileAvatar uri={avatarPreviewUrl} gifId={avatarId} size={64} iconColor={themeColors.onAccent} backgroundColor={themeColors.accent} style={styles.avatar} />

          <View
            style={
              styles.headerInfo
            }
          >
            <Text style={styles.userName}>{userName}</Text>

            <Text
              style={[styles.email, { color: colors.textSecondary }]}
            >
              {auth.currentUser
                ?.email ||
                "No email"}
            </Text>
          </View>
        </View>

        {/* STATS */}

        <View
          style={
            styles.statsContainer
          }
        >
          <StatItem
            value={
              totalGames
            }
            label="Library"
            valueColor={colors.text}
            labelColor={colors.textSecondary}
          />

          <View
            style={
              styles.statDivider
            }
          />

          <StatItem
            value={
              playing.length
            }
            label="Playing"
            valueColor={colors.text}
            labelColor={colors.textSecondary}
          />

          <View
            style={
              styles.statDivider
            }
          />

          <StatItem
            value={
              completed.length
            }
            label="Completed"
            valueColor={colors.text}
            labelColor={colors.textSecondary}
          />

          <View
            style={
              styles.statDivider
            }
          />

          <StatItem
            value={
              claimed.length
            }
            label="Claimed"
            valueColor={colors.text}
            labelColor={colors.textSecondary}
          />
        </View>

        {/* ACCOUNT */}

        <View style={[styles.accountHeadingRow, { marginTop: 8, marginBottom: 8 }]}>
          <Text style={[styles.mainSectionTitle, { color: colors.text }]}>Account</Text>
        </View>

        <View
          style={
            styles.settingsCard
          }
        >
          {/* EDIT PROFILE */}

          <TouchableOpacity
            style={
              styles.settingsRow
            }
            onPress={() => router.push("/edit-profile")}
          >
            <View
              style={
                styles.settingsIcon
              }
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={themeColors.accentText}
              />
            </View>

            <View
              style={
                styles.settingsTextContainer
              }
            >
              <Text
                style={
                  styles.settingsTitle
                }
              >
                Edit Profile
              </Text>

              <Text
                style={[styles.settingsSubtitle, { color: colors.textSecondary }]}
              >
                Name, age, username and social links
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={themeColors.muted}
            />
          </TouchableOpacity>

          <View
            style={
              styles.separator
            }
          />

          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push("/appearance")}>
            <View style={styles.settingsIcon}>
              <Ionicons name="color-palette-outline" size={20} color={themeColors.accentText} />
            </View>
            <View style={styles.settingsTextContainer}>
              <Text style={styles.settingsTitle}>Appearance</Text>
              <Text style={[styles.settingsSubtitle, { color: colors.textSecondary }]}>{modeLabel} mode · {ACCENT_THEMES.find((item) => item.id === accentTheme)?.label || "Classic"} colors</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.muted} />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push("/pc-compatibility")}>
            <View style={styles.settingsIcon}>
              <Ionicons name="hardware-chip-outline" size={20} color={themeColors.accentText} />
            </View>
            <View style={styles.settingsTextContainer}>
              <Text style={styles.settingsTitle}>PC compatibility</Text>
              <Text style={[styles.settingsSubtitle, { color: colors.textSecondary }]}>Save your specs and check game FPS</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.muted} />
          </TouchableOpacity>

          <View style={styles.separator} />

          {/* ACCOUNT SETTINGS */}

          <TouchableOpacity
            style={
              styles.settingsRow
            }
            onPress={
              openAccountSettings
            }
          >
            <View
              style={
                styles.settingsIcon
              }
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color={themeColors.accentText}
              />
            </View>

            <View
              style={
                styles.settingsTextContainer
              }
            >
              <Text
                style={
                  styles.settingsTitle
                }
              >
                Account Settings
              </Text>

              <Text
                style={[styles.settingsSubtitle, { color: colors.textSecondary }]}
              >
                Update email and password
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={themeColors.muted}
            />
          </TouchableOpacity>

          <View
            style={
              styles.separator
            }
          />

          {/* PREFERENCES */}

          <TouchableOpacity
            style={
              styles.settingsRow
            }
            onPress={
              openPreferenceEditor
            }
          >
            <View
              style={
                styles.settingsIcon
              }
            >
              <Ionicons
                name="game-controller-outline"
                size={20}
                color={themeColors.accentText}
              />
            </View>

            <View
              style={
                styles.settingsTextContainer
              }
            >
              <Text
                style={
                  styles.settingsTitle
                }
              >
                Game Preferences
              </Text>

              <Text
                style={[styles.settingsSubtitle, { color: colors.textSecondary }]}
              >
                {selectedCats.length > 0
                  ? `${selectedCats.length} selected`
                  : "Choose your favorite genres"}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={themeColors.muted}
            />
          </TouchableOpacity>

          <View
            style={
              styles.separator
            }
          />

          <View style={styles.settingsRow}>
            <View style={styles.settingsIcon}>
              <Ionicons name="eye-off-outline" size={20} color={themeColors.accentText} />
            </View>
            <View style={styles.settingsTextContainer}>
              <Text style={styles.settingsTitle}>Hide sexual content</Text>
              <Text style={[styles.settingsSubtitle, { color: colors.textSecondary }]}>
                {isUnder18OrUnknown ? "Always on for under-18 or unknown age" : "Filter games tagged with sexual content"}
              </Text>
            </View>
            <Switch
              value={sexualContentFilter || isUnder18OrUnknown}
              onValueChange={handleToggleSexualContentFilter}
              disabled={isUnder18OrUnknown || loadingPreferences}
              trackColor={{ false: themeColors.surfaceRaised, true: themeColors.accent }}
              thumbColor={sexualContentFilter ? themeColors.onAccent : themeColors.muted}
            />
          </View>

          <View
            style={
              styles.separator
            }
          />

          {/* LOGOUT */}

          <TouchableOpacity
            style={
              styles.settingsRow
            }
            onPress={
              handleLogout
            }
          >
            <View
              style={[
                styles.settingsIcon,
                styles.logoutIcon,
              ]}
            >
              <Ionicons
                name="log-out-outline"
                size={20}
                color={themeColors.danger}
              />
            </View>

            <View
              style={
                styles.settingsTextContainer
              }
            >
              <Text
                style={
                  styles.logoutText
                }
              >
                Log Out
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* PREFERENCES */}

        <View
          style={
            styles.preferenceHeader
          }
        >
          <Text
            style={
              styles.mainSectionTitle
            }
          >
            Your Preferences
          </Text>

          <TouchableOpacity
            onPress={
              openPreferenceEditor
            }
          >
            <Text
              style={
                styles.editPreferencesText
              }
            >
              Edit
            </Text>
          </TouchableOpacity>
        </View>

        {loadingPreferences ? (
          <ActivityIndicator
            color={themeColors.accentText}
          />
        ) : selectedCats.length > 0 ? (
          <View
            style={
              styles.preferenceList
            }
          >
            {selectedCats.map(
              (category) => (
                <View
                  key={
                    category
                  }
                  style={
                    styles.preferenceChip
                  }
                >
                  <Text
                    style={
                      styles.preferenceChipText
                    }
                  >
                    {category
                      .charAt(0)
                      .toUpperCase() +
                      category.slice(1)}
                  </Text>
                </View>
              )
            )}
          </View>
        ) : (
          <Text
            style={
              styles.noPreferences
            }
          >
            No game preferences selected yet.
          </Text>
        )}

        {/* GAME LIBRARY */}

        <Text
          style={[
            styles.mainSectionTitle,
            {
              marginTop: 25,
            },
          ]}
        >
          My Games
        </Text>
        <Animated.View entering={FadeInUp.duration(220).reduceMotion(ReduceMotion.System)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open My Games. ${totalGames} saved, ${playing.length} currently playing.`}
            onPress={() => router.push("/my-games")}
            style={({ pressed }) => [styles.libraryCard, pressed && styles.libraryCardPressed]}
          >
            <View style={styles.libraryIcon}>
              <Ionicons name="game-controller" size={25} color={themeColors.onAccent} />
            </View>
            <View style={styles.libraryCardText}>
              <Text style={styles.libraryCardTitle}>Open your library</Text>
              <Text style={styles.libraryCardSubtitle}>
                {totalGames} saved · {playing.length} playing now
              </Text>
              <Text style={styles.libraryCardMeta}>Browse by status, update or remove games</Text>
            </View>
            <Ionicons name="chevron-forward" size={21} color={themeColors.accentText} />
          </Pressable>
        </Animated.View>

        <View
          style={{
            height: 120,
          }}
        />
      </ScrollView>

      {/* =================================================== */}
      {/* PREFERENCES MODAL */}
      {/* =================================================== */}

      <Modal
        visible={
          preferencesVisible
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setPreferencesVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalContainer
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Game Preferences
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Choose what you like to play
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setPreferencesVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={27}
                  color={themeColors.text}
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.preferenceModalGrid
              }
            >
              {CATEGORIES.map(
                (category) => {
                  const active =
                    tempSelectedCats.includes(
                      category.toLowerCase()
                    );

                  return (
                    <Pressable
                      key={
                        category
                      }
                      style={[
                        styles.modalChip,

                        active &&
                          styles.modalChipActive,
                      ]}
                      onPress={() =>
                        togglePreference(
                          category
                        )
                      }
                    >
                      {active && (
                        <Ionicons
                          name="checkmark"
                          size={15}
                          color={themeColors.onAccent}
                        />
                      )}

                      <Text
                        style={[
                          styles.modalChipText,

                          active &&
                            styles.modalChipTextActive,
                        ]}
                      >
                        {category}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>

            <Pressable
              style={
                styles.savePreferencesButton
              }
              onPress={
                handleSavePreferences
              }
              disabled={
                savingPreferences
              }
            >
              {savingPreferences ? (
                <ActivityIndicator
                  color={themeColors.onAccent}
                />
              ) : (
                <Text
                  style={
                    styles.savePreferencesText
                  }
                >
                  Save Preferences
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* =================================================== */}
      {/* ACCOUNT SETTINGS MODAL */}
      {/* =================================================== */}

      <Modal
        visible={
          accountSettingsVisible
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setAccountSettingsVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.accountModalContainer
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Account Settings
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Manage your login information
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setAccountSettingsVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={27}
                  color={themeColors.text}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              {/* EMAIL */}

              <Text
                style={
                  styles.accountSectionTitle
                }
              >
                Email Address
              </Text>

              <Text
                style={
                  styles.accountDescription
                }
              >
                Change the email associated with your account.
              </Text>

              <View
                style={
                  styles.accountInputContainer
                }
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={themeColors.muted}
                />

                <TextInput
                  style={
                    styles.accountInput
                  }
                  value={
                    newEmail
                  }
                  onChangeText={
                    setNewEmail
                  }
                  placeholder="Email address"
                  placeholderTextColor={themeColors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={
                    false
                  }
                />
              </View>

              <Pressable
                style={
                  styles.accountUpdateButton
                }
                onPress={
                  handleUpdateEmail
                }
                disabled={
                  updatingEmail
                }
              >
                {updatingEmail ? (
                  <ActivityIndicator
                    color={themeColors.onAccent}
                  />
                ) : (
                  <Text
                    style={
                      styles.accountUpdateButtonText
                    }
                  >
                    Update Email
                  </Text>
                )}
              </Pressable>

              <View
                style={
                  styles.accountDivider
                }
              />

              {/* PASSWORD */}

              <Text
                style={
                  styles.accountSectionTitle
                }
              >
                Change Password
              </Text>

              <Text
                style={
                  styles.accountDescription
                }
              >
                Enter and confirm your new password.
              </Text>

              <View
                style={
                  styles.accountInputContainer
                }
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={themeColors.muted}
                />

                <TextInput
                  style={
                    styles.accountInput
                  }
                  value={
                    newPassword
                  }
                  onChangeText={
                    setNewPassword
                  }
                  placeholder="New password"
                  placeholderTextColor={themeColors.muted}
                  secureTextEntry={
                    !showPassword
                  }
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  onPress={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                >
                  <Ionicons
                    name={
                      showPassword
                        ? "eye-off-outline"
                        : "eye-outline"
                    }
                    size={21}
                    color={themeColors.muted}
                  />
                </TouchableOpacity>
              </View>

              <View
                style={
                  styles.accountInputContainer
                }
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={themeColors.muted}
                />

                <TextInput
                  style={
                    styles.accountInput
                  }
                  value={
                    confirmPassword
                  }
                  onChangeText={
                    setConfirmPassword
                  }
                  placeholder="Confirm new password"
                  placeholderTextColor={themeColors.muted}
                  secureTextEntry={
                    !showPassword
                  }
                  autoCapitalize="none"
                />
              </View>

              <Pressable
                style={
                  styles.accountUpdateButton
                }
                onPress={
                  handleUpdatePassword
                }
                disabled={
                  updatingPassword
                }
              >
                {updatingPassword ? (
                  <ActivityIndicator
                    color={themeColors.onAccent}
                  />
                ) : (
                  <Text
                    style={
                      styles.accountUpdateButtonText
                    }
                  >
                    Change Password
                  </Text>
                )}
              </Pressable>

              <View
                style={{
                  height: 20,
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ============================================================
// STAT ITEM
// ============================================================

const StatItem = ({
  value,
  label,
  valueColor,
  labelColor,
}: {
  value: number;
  label: string;
  valueColor: string;
  labelColor: string;
}) => (
  <View
    style={
      styles.statItem
    }
  >
    <Text style={[styles.statNumber, { color: valueColor }]}>
      {value}
    </Text>

    <Text
      style={[styles.statLabel, { color: labelColor }]}
    >
      {label}
    </Text>
  </View>
);

// ============================================================
// STYLES
// ============================================================

const styles = createThemedStyles({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 15,
  },

  // PROFILE

  header: {
    marginTop: 55,
    marginBottom: 25,
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#f5c518",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },

  headerInfo: {
    flex: 1,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  userName: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "bold",
  },

  email: {
    color: "#777",
    fontSize: 12,
    marginTop: 4,
  },

  nameInput: {
    color: "#fff",
    fontSize: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#f5c518",
    flex: 0.85,
    paddingVertical: 4,
  },

  // STATS

  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#1e1e1e",
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#292929",
  },

  statItem: {
    flex: 1,
    alignItems: "center",
  },

  statNumber: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "bold",
  },

  statLabel: {
    color: "#777",
    fontSize: 10,
    marginTop: 3,
  },

  statDivider: {
    width: 1,
    backgroundColor: "#333",
  },

  // SECTION TITLES

  accountHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  mainSectionTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 12,
  },

  // SETTINGS

  settingsCard: {
    backgroundColor: "#1e1e1e",
    borderRadius: 14,
    marginBottom: 25,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#292929",
  },

  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
  },


  settingsIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(245,197,24,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  logoutIcon: {
    backgroundColor: "rgba(255,68,68,0.1)",
  },

  settingsTextContainer: {
    flex: 1,
  },

  settingsTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  settingsSubtitle: {
    color: "#777",
    fontSize: 11,
    marginTop: 3,
  },

  logoutText: {
    color: "#ff4444",
    fontSize: 14,
    fontWeight: "600",
  },

  separator: {
    height: 1,
    backgroundColor: "#292929",
    marginLeft: 65,
  },

  // PREFERENCES

  preferenceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  editPreferencesText: {
    color: "#f5c518",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 12,
  },

  preferenceList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 5,
  },

  preferenceChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(245,197,24,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,197,24,0.35)",
  },

  preferenceChipText: {
    color: "#f5c518",
    fontSize: 11,
    fontWeight: "600",
  },

  noPreferences: {
    color: "#666",
    fontSize: 12,
    marginBottom: 10,
  },

  libraryCard: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 18,
    borderRadius: 16,
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#303030",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  libraryCardPressed: { backgroundColor: "#252525", transform: [{ scale: 0.99 }] },
  libraryIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: "#f5c518", alignItems: "center", justifyContent: "center" },
  libraryCardText: { flex: 1 },
  libraryCardTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  libraryCardSubtitle: { color: "#f5c518", fontSize: 12, fontWeight: "700", marginTop: 4 },
  libraryCardMeta: { color: "#888", fontSize: 10, marginTop: 5 },

  // MODAL

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: "#181818",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 22,
    paddingBottom: 35,
  },

  accountModalContainer: {
    backgroundColor: "#181818",
    maxHeight: "85%",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 22,
    paddingBottom: 30,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },

  modalTitle: {
    color: "#fff",
    fontSize: 21,
    fontWeight: "bold",
  },

  modalSubtitle: {
    color: "#777",
    fontSize: 12,
    marginTop: 4,
  },

  // PREFERENCE MODAL

  preferenceModalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  modalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#252525",
    borderWidth: 1,
    borderColor: "#444",
  },

  modalChipActive: {
    backgroundColor: "#f5c518",
    borderColor: "#f5c518",
  },

  modalChipText: {
    color: "#bbb",
    fontSize: 12,
    fontWeight: "600",
  },

  modalChipTextActive: {
    color: "#000",
  },

  savePreferencesButton: {
    backgroundColor: "#f5c518",
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 30,
  },

  savePreferencesText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 14,
  },

  // ACCOUNT SETTINGS

  accountSectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },

  accountDescription: {
    color: "#777",
    fontSize: 12,
    marginBottom: 15,
  },

  accountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252525",
    borderWidth: 1,
    borderColor: "#383838",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
  },

  accountInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    marginLeft: 10,
  },

  accountUpdateButton: {
    height: 48,
    backgroundColor: "#f5c518",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },

  accountUpdateButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "bold",
  },

  accountDivider: {
    height: 1,
    backgroundColor: "#333",
    marginVertical: 25,
  },
});
