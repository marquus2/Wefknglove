#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;

[InitializeOnLoad]
public static class FloorplanLayoutAutoApply
{
    private static bool isApplying;
    private static bool pendingApply;

    static FloorplanLayoutAutoApply()
    {
        EditorSceneManager.sceneOpened -= OnSceneOpened;
        EditorSceneManager.sceneOpened += OnSceneOpened;

        EditorSceneManager.sceneSaving -= OnSceneSaving;
        EditorSceneManager.sceneSaving += OnSceneSaving;

        QueueApply("Editor loaded");
    }

    private static void OnSceneOpened(Scene scene, OpenSceneMode mode)
    {
        QueueApply("Scene opened: " + scene.name);
    }

    private static void OnSceneSaving(Scene scene, string path)
    {
        ApplyNow(false, false, "Scene saving: " + scene.name);
    }

    private static void QueueApply(string reason)
    {
        if (pendingApply) return;
        pendingApply = true;

        EditorApplication.delayCall += () =>
        {
            pendingApply = false;
            ApplyNow(false, true, reason);
        };
    }

    private static void ApplyNow(bool includeSceneLoading, bool openedEventOnly, string reason)
    {
        if (isApplying) return;
        if (EditorApplication.isPlayingOrWillChangePlaymode) return;

        isApplying = true;
        try
        {
            FloorplanMasterLayoutEditorBridge.ApplyAllOpenLayouts(
                includeSceneLoading,
                saveModifiedScenes: false,
                openedEventOnly: openedEventOnly,
                reason: reason);
        }
        finally
        {
            isApplying = false;
        }
    }
}
#endif
