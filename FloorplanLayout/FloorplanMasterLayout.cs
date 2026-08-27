using System.Collections.Generic;
using UnityEngine;

[ExecuteAlways]
[DisallowMultipleComponent]
[AddComponentMenu("BM Identity/Floorplan/Master Layout")]
public class FloorplanMasterLayout : MonoBehaviour
{
    [Header("JSON")]
    [Tooltip("SAMBO exported JSON. Used when assigned; otherwise Json File Path is used.")]
    public TextAsset floorplanJson;

    [Tooltip("Absolute path or project-relative path. Example: Assets/BM_Identity/04_GENERIC_SCRIPTS/TEMP/blackmirror-v0028.json")]
    public string jsonFilePath;

    [Header("Scenes")]
    public string masterScenePath = "Assets/BM_Identity/01_SCENES/MASTER/MASTER.unity";
    public bool openSecondaryScenesAdditive = true;
    public bool saveModifiedScenes = true;
    public List<string> secondaryScenePaths = new List<string>();

    [Header("Editor Auto Apply")]
    public bool autoApplyOnSceneOpened = true;
    public bool autoApplyBeforeSceneSave = true;

    [Header("Coordinate Mapping")]
    public FloorplanCoordinateSettings coordinates = new FloorplanCoordinateSettings();

    [Header("Explicit Bindings")]
    [Tooltip("Optional direct bindings. The tool also scans all open scenes for FloorplanLevelBinding components.")]
    public List<FloorplanLevelBinding> levelBindings = new List<FloorplanLevelBinding>();

    [Tooltip("Optional direct bindings. The tool also scans all open scenes for FloorplanPathBinding components.")]
    public List<FloorplanPathBinding> pathBindings = new List<FloorplanPathBinding>();

    [Header("Status")]
    [TextArea(4, 12)] public string lastReport;

    public string JsonText
    {
        get
        {
            if (floorplanJson != null)
                return floorplanJson.text;

#if UNITY_EDITOR
            string path = FloorplanMasterLayoutEditorBridge.ResolveJsonPath(jsonFilePath);
            if (!string.IsNullOrEmpty(path) && System.IO.File.Exists(path))
                return System.IO.File.ReadAllText(path);
#endif
            return string.Empty;
        }
    }

    [ContextMenu("Apply JSON To Open Scenes")]
    public void ApplyJsonToOpenScenes()
    {
#if UNITY_EDITOR
        FloorplanMasterLayoutEditorBridge.ApplyJsonToScenes(this);
#else
        Debug.LogWarning("Floorplan layout is editor-only.", this);
#endif
    }

    [ContextMenu("Write Open Scene Layout To JSON")]
    public void WriteOpenSceneLayoutToJson()
    {
#if UNITY_EDITOR
        FloorplanMasterLayoutEditorBridge.WriteOpenSceneLayoutToJson(this);
#else
        Debug.LogWarning("Floorplan layout is editor-only.", this);
#endif
    }
}

#if !UNITY_EDITOR
public static class FloorplanMasterLayoutEditorBridge
{
    public static string ResolveJsonPath(string path) { return path; }
}
#endif
