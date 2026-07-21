import { auth, db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
} from "firebase/auth";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import React, { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const router = useRouter();

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

  const [expanded, setExpanded] = useState({
    claimed: true,
    playing: true,
    completed: false,
    backlog: false,
  });

  // ==========================================================
  // PROFILE
  // ==========================================================

  const [userName, setUserName] = useState(
    auth.currentUser?.displayName || "Gamer"
  );

  const [isEditingName, setIsEditingName] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);

  // ==========================================================
  // PREFERENCES
  // ==========================================================

  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [tempSelectedCats, setTempSelectedCats] = useState<string[]>([]);

  const [preferencesVisible, setPreferencesVisible] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);

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
        }
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
  // UPDATE GAME STATUS
  // ==========================================================

  const handleUpdateStatus = async (
    id: string,
    newStatus: string
  ) => {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    try {
      const gameRef = doc(
        db,
        "users",
        user.uid,
        "gameStatus",
        id
      );

      await updateDoc(gameRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(
        "Update Status Error:",
        error
      );

      Alert.alert(
        "Error",
        "Could not update game status."
      );
    }
  };

  // ==========================================================
  // REMOVE GAME
  // ==========================================================

  const handleRemove = (
    id: string,
    title: string
  ) => {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    Alert.alert(
      "Remove Game",
      `Are you sure you want to remove ${title}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",

          onPress: async () => {
            try {
              await deleteDoc(
                doc(
                  db,
                  "users",
                  user.uid,
                  "gameStatus",
                  id
                )
              );
            } catch (error) {
              Alert.alert(
                "Error",
                "Could not remove the game."
              );
            }
          },
        },
      ]
    );
  };

  // ==========================================================
  // UPDATE DISPLAY NAME
  // ==========================================================

  const handleSaveName = async () => {
    const user = auth.currentUser;

    if (
      !user ||
      userName.trim() === ""
    ) {
      return;
    }

    setUpdatingName(true);

    try {
      await updateProfile(user, {
        displayName: userName.trim(),
      });

      await setDoc(
        doc(
          db,
          "users",
          user.uid
        ),
        {
          displayName:
            userName.trim(),

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      setIsEditingName(false);

      Alert.alert(
        "Profile Updated",
        "Your display name has been updated."
      );
    } catch (error) {
      console.error(
        "Name Update Error:",
        error
      );

      Alert.alert(
        "Error",
        "Failed to update profile name."
      );
    } finally {
      setUpdatingName(false);
    }
  };

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
      Alert.alert(
        "Invalid Email",
        "Please enter an email address."
      );

      return;
    }

    if (
      email ===
      user.email
    ) {
      Alert.alert(
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

      Alert.alert(
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
        Alert.alert(
          "Sign In Again",
          "For security, please log out and sign in again before changing your email."
        );

        return;
      }

      if (
        error?.code ===
        "auth/email-already-in-use"
      ) {
        Alert.alert(
          "Email Already Used",
          "Another account is already using this email."
        );

        return;
      }

      if (
        error?.code ===
        "auth/invalid-email"
      ) {
        Alert.alert(
          "Invalid Email",
          "Please enter a valid email address."
        );

        return;
      }

      Alert.alert(
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
      Alert.alert(
        "Password Too Short",
        "Your password must contain at least 6 characters."
      );

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      Alert.alert(
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

      Alert.alert(
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
        Alert.alert(
          "Sign In Again",
          "For security, please log out and sign in again before changing your password."
        );

        return;
      }

      if (
        error?.code ===
        "auth/weak-password"
      ) {
        Alert.alert(
          "Weak Password",
          "Please choose a stronger password."
        );

        return;
      }

      Alert.alert(
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

        Alert.alert(
          "Preferences Updated",
          "Your game preferences have been saved."
        );
      } catch (error) {
        console.error(
          "Preference Save Error:",
          error
        );

        Alert.alert(
          "Error",
          "Failed to update preferences."
        );
      } finally {
        setSavingPreferences(
          false
        );
      }
    };

  // ==========================================================
  // COLLAPSIBLE SECTION
  // ==========================================================

  const toggleSection = (
    section:
      keyof typeof expanded
  ) => {
    setExpanded(
      (previous) => ({
        ...previous,

        [section]:
          !previous[
            section
          ],
      })
    );
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {
    Alert.alert(
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
              Alert.alert(
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
  // GAME CARD
  // ==========================================================

  const renderGameCard = ({
    item,
  }: {
    item: any;
  }) => (
    <View style={styles.card}>
      <Pressable
        onPress={() =>
          router.push({
            pathname:
              "/details",

            params: {
              id:
                item.id,
            },
          })
        }
      >
        <Image
          source={{
            uri:
              item.thumbnail,
          }}
          style={
            styles.thumb
          }
        />
      </Pressable>

      <Text
        style={
          styles.cardTitle
        }
        numberOfLines={1}
      >
        {item.title}
      </Text>

      <View
        style={
          styles.cardActions
        }
      >
        <TouchableOpacity
          style={
            styles.gameActionButton
          }
          onPress={() =>
            handleUpdateStatus(
              item.id,
              "Playing"
            )
          }
        >
          <Ionicons
            name="play"
            size={15}
            color="#f5c518"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.gameActionButton
          }
          onPress={() =>
            handleUpdateStatus(
              item.id,
              "Completed"
            )
          }
        >
          <Ionicons
            name="checkmark-done"
            size={15}
            color="#4CAF50"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.gameActionButton
          }
          onPress={() =>
            handleUpdateStatus(
              item.id,
              "To Play"
            )
          }
        >
          <Ionicons
            name="bookmark-outline"
            size={15}
            color="#4da6ff"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.gameActionButton
          }
          onPress={() =>
            handleRemove(
              item.id,
              item.title
            )
          }
        >
          <Ionicons
            name="trash-outline"
            size={15}
            color="#ff4444"
          />
        </TouchableOpacity>
      </View>
    </View>
  );

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
        style={
          styles.container
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* PROFILE HEADER */}

        <View
          style={
            styles.header
          }
        >
          <View
            style={
              styles.avatar
            }
          >
            <Ionicons
              name="person"
              size={32}
              color="#121212"
            />
          </View>

          <View
            style={
              styles.headerInfo
            }
          >
            {isEditingName ? (
              <View
                style={
                  styles.editRow
                }
              >
                <TextInput
                  style={
                    styles.nameInput
                  }
                  value={
                    userName
                  }
                  onChangeText={
                    setUserName
                  }
                  autoFocus
                />

                <TouchableOpacity
                  onPress={
                    handleSaveName
                  }
                >
                  {updatingName ? (
                    <ActivityIndicator
                      size="small"
                      color="#f5c518"
                    />
                  ) : (
                    <Ionicons
                      name="checkmark-circle"
                      size={27}
                      color="#f5c518"
                    />
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={
                  styles.nameRow
                }
                onPress={() =>
                  setIsEditingName(
                    true
                  )
                }
              >
                <Text
                  style={
                    styles.userName
                  }
                >
                  {userName}
                </Text>

                <Ionicons
                  name="pencil"
                  size={15}
                  color="#f5c518"
                />
              </TouchableOpacity>
            )}

            <Text
              style={
                styles.email
              }
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
          />
        </View>

        {/* ACCOUNT */}

        <Text
          style={
            styles.mainSectionTitle
          }
        >
          Account
        </Text>

        <View
          style={
            styles.settingsCard
          }
        >
          {/* DISPLAY NAME */}

          <TouchableOpacity
            style={
              styles.settingsRow
            }
            onPress={() =>
              setIsEditingName(
                true
              )
            }
          >
            <View
              style={
                styles.settingsIcon
              }
            >
              <Ionicons
                name="person-outline"
                size={20}
                color="#f5c518"
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
                Display Name
              </Text>

              <Text
                style={
                  styles.settingsSubtitle
                }
              >
                {userName}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#777"
            />
          </TouchableOpacity>

          <View
            style={
              styles.separator
            }
          />

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
                color="#f5c518"
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
                style={
                  styles.settingsSubtitle
                }
              >
                Update email and password
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#777"
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
                color="#f5c518"
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
                style={
                  styles.settingsSubtitle
                }
              >
                {selectedCats.length > 0
                  ? `${selectedCats.length} selected`
                  : "Choose your favorite genres"}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#777"
            />
          </TouchableOpacity>

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
                color="#ff4444"
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
            color="#f5c518"
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

        <CollapsibleSection
          title="Claimed Games 🎁"
          data={claimed}
          isOpen={
            expanded.claimed
          }
          onToggle={() =>
            toggleSection(
              "claimed"
            )
          }
          render={
            renderGameCard
          }
        />

        <CollapsibleSection
          title="Currently Playing 🎮"
          data={playing}
          isOpen={
            expanded.playing
          }
          onToggle={() =>
            toggleSection(
              "playing"
            )
          }
          render={
            renderGameCard
          }
        />

        <CollapsibleSection
          title="Completed 🏆"
          data={completed}
          isOpen={
            expanded.completed
          }
          onToggle={() =>
            toggleSection(
              "completed"
            )
          }
          render={
            renderGameCard
          }
        />

        <CollapsibleSection
          title="To Play (Backlog) 📂"
          data={backlog}
          isOpen={
            expanded.backlog
          }
          onToggle={() =>
            toggleSection(
              "backlog"
            )
          }
          render={
            renderGameCard
          }
        />

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
                  color="#fff"
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
                          color="#000"
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
                  color="#000"
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
                  color="#fff"
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
                  color="#777"
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
                  placeholderTextColor="#666"
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
                    color="#000"
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
                  color="#777"
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
                  placeholderTextColor="#666"
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
                    color="#777"
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
                  color="#777"
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
                  placeholderTextColor="#666"
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
                    color="#000"
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
}: {
  value: number;
  label: string;
}) => (
  <View
    style={
      styles.statItem
    }
  >
    <Text
      style={
        styles.statNumber
      }
    >
      {value}
    </Text>

    <Text
      style={
        styles.statLabel
      }
    >
      {label}
    </Text>
  </View>
);

// ============================================================
// COLLAPSIBLE SECTION
// ============================================================

const CollapsibleSection = ({
  title,
  data,
  isOpen,
  onToggle,
  render,
}: any) => (
  <View
    style={
      styles.section
    }
  >
    <TouchableOpacity
      style={
        styles.sectionHeader
      }
      onPress={
        onToggle
      }
    >
      <Text
        style={
          styles.sectionTitle
        }
      >
        {title} ({data.length})
      </Text>

      <Ionicons
        name={
          isOpen
            ? "chevron-up"
            : "chevron-down"
        }
        size={18}
        color="#f5c518"
      />
    </TouchableOpacity>

    {isOpen && (
      <FlatList
        horizontal
        data={
          data
        }
        renderItem={
          render
        }
        keyExtractor={(
          item
        ) =>
          item.id.toString()
        }
        showsHorizontalScrollIndicator={
          false
        }
        ListEmptyComponent={
          <Text
            style={
              styles.empty
            }
          >
            Empty section
          </Text>
        }
        contentContainerStyle={{
          paddingLeft: 15,
          paddingBottom: 15,
        }}
      />
    )}
  </View>
);

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
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

  // GAME SECTIONS

  section: {
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#292929",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    alignItems: "center",
    backgroundColor: "#252525",
  },

  sectionTitle: {
    color: "#f5c518",
    fontSize: 14,
    fontWeight: "bold",
  },

  card: {
    marginRight: 15,
    width: 125,
    paddingVertical: 10,
  },

  thumb: {
    width: 125,
    height: 75,
    borderRadius: 8,
    backgroundColor: "#333",
  },

  cardTitle: {
    color: "#fff",
    fontSize: 10,
    marginTop: 6,
    fontWeight: "600",
  },

  cardActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#444",
    paddingTop: 7,
  },

  gameActionButton: {
    padding: 4,
  },

  empty: {
    color: "#555",
    fontSize: 12,
    padding: 20,
  },

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