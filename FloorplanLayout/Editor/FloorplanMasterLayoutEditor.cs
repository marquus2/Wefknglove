#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

[CustomEditor(typeof(FloorplanMasterLayout))]
public class FloorplanMasterLayoutEditor : Editor
{
    private SerializedProperty floorplanJson;
    private SerializedProperty jsonFilePath;
    private SerializedProperty masterScenePath;
    private SerializedProperty openSecondaryScenesAdditive;
    private SerializedProperty saveModifiedScenes;
    private SerializedProperty secondaryScenePaths;
    private SerializedProperty autoApplyOnSceneOpened;
    private SerializedProperty autoApplyBeforeSceneSave;
    private SerializedProperty coordinates;
    private SerializedProperty levelBindings;
    private SerializedProperty pathBindings;
    private SerializedProperty lastReport;

    private GUIStyle headerStyle;
    private GUIStyle cardStyle;
    private GUIStyle subtitleStyle;

    private void OnEnable()
    {
        floorplanJson = serializedObject.FindProperty("floorplanJson");
        jsonFilePath = serializedObject.FindProperty("jsonFilePath");
        masterScenePath = serializedObject.FindProperty("masterScenePath");
        openSecondaryScenesAdditive = serializedObject.FindProperty("openSecondaryScenesAdditive");
        saveModifiedScenes = serializedObject.FindProperty("saveModifiedScenes");
        secondaryScenePaths = serializedObject.FindProperty("secondaryScenePaths");
        autoApplyOnSceneOpened = serializedObject.FindProperty("autoApplyOnSceneOpened");
        autoApplyBeforeSceneSave = serializedObject.FindProperty("autoApplyBeforeSceneSave");
        coordinates = serializedObject.FindProperty("coordinates");
        levelBindings = serializedObject.FindProperty("levelBindings");
        pathBindings = serializedObject.FindProperty("pathBindings");
        lastReport = serializedObject.FindProperty("lastReport");
    }

    public override void OnInspectorGUI()
    {
        EnsureStyles();
        serializedObject.Update();

        var layout = (FloorplanMasterLayout)target;

        EditorGUILayout.Space(4);
        EditorGUILayout.LabelField("SAMBO Floorplan Layout", headerStyle);
        EditorGUILayout.LabelField("Editor-only scene placement and path synchronization.", subtitleStyle);
        EditorGUILayout.Space(8);

        DrawCard("JSON Source", () =>
        {
            EditorGUILayout.PropertyField(floorplanJson);
            EditorGUILayout.PropertyField(jsonFilePath);
            using (new EditorGUI.DisabledScope(true))
                EditorGUILayout.TextField("Resolved Path", FloorplanMasterLayoutEditorBridge.ResolveJsonPath(jsonFilePath.stringValue));
        });

        DrawCard("Scene Loading", () =>
        {
            EditorGUILayout.PropertyField(masterScenePath);
            EditorGUILayout.PropertyField(openSecondaryScenesAdditive);
            EditorGUILayout.PropertyField(saveModifiedScenes);
            EditorGUILayout.PropertyField(secondaryScenePaths, true);
        });

        DrawCard("Editor Auto Apply", () =>
        {
            EditorGUILayout.PropertyField(autoApplyOnSceneOpened, new GUIContent("Apply When Scene Opens"));
            EditorGUILayout.PropertyField(autoApplyBeforeSceneSave, new GUIContent("Apply Before Scene Save"));
            EditorGUILayout.HelpBox("Auto apply syncs only the scenes that are already open. It will not open secondary scenes automatically.", MessageType.Info);
        });

        DrawCard("Coordinate Mapping", () =>
        {
            EditorGUILayout.PropertyField(coordinates, true);
        });

        DrawCard("Bindings", () =>
        {
            EditorGUILayout.PropertyField(levelBindings, true);
            EditorGUILayout.Space(4);
            EditorGUILayout.PropertyField(pathBindings, true);
            EditorGUILayout.HelpBox("Direct bindings are optional. The tool also scans loaded scenes for Level Binding and Path Binding components.", MessageType.Info);
        });

        DrawActions(layout);

        DrawCard("Status", () =>
        {
            EditorGUILayout.PropertyField(lastReport);
        });

        serializedObject.ApplyModifiedProperties();
    }

    private void DrawActions(FloorplanMasterLayout layout)
    {
        DrawCard("Editor Actions", () =>
        {
            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Apply JSON To Scenes", GUILayout.Height(34)))
                {
                    serializedObject.ApplyModifiedProperties();
                    layout.ApplyJsonToOpenScenes();
                }

                if (GUILayout.Button("Write Open Scenes To JSON", GUILayout.Height(34)))
                {
                    serializedObject.ApplyModifiedProperties();
                    layout.WriteOpenSceneLayoutToJson();
                }
            }

            EditorGUILayout.Space(6);
            if (GUILayout.Button("Collect Scene Paths From BM_Identity/01_SCENES", GUILayout.Height(24)))
                CollectScenePaths();
        });
    }

    private void CollectScenePaths()
    {
        const string root = "Assets/BM_Identity/01_SCENES";
        string[] guids = AssetDatabase.FindAssets("t:Scene", new[] { root });
        secondaryScenePaths.ClearArray();

        int index = 0;
        foreach (string guid in guids)
        {
            string path = AssetDatabase.GUIDToAssetPath(guid);
            if (path.EndsWith("/MASTER.unity")) continue;

            secondaryScenePaths.InsertArrayElementAtIndex(index);
            secondaryScenePaths.GetArrayElementAtIndex(index).stringValue = path;
            index++;
        }
    }

    private void DrawCard(string title, System.Action content)
    {
        EditorGUILayout.BeginVertical(cardStyle);
        EditorGUILayout.LabelField(title, EditorStyles.boldLabel);
        EditorGUILayout.Space(2);
        content?.Invoke();
        EditorGUILayout.EndVertical();
        EditorGUILayout.Space(6);
    }

    private void EnsureStyles()
    {
        if (headerStyle != null) return;

        headerStyle = new GUIStyle(EditorStyles.boldLabel)
        {
            fontSize = 15,
            fixedHeight = 22
        };

        subtitleStyle = new GUIStyle(EditorStyles.miniLabel)
        {
            wordWrap = true
        };

        cardStyle = new GUIStyle(EditorStyles.helpBox)
        {
            padding = new RectOffset(10, 10, 8, 10),
            margin = new RectOffset(0, 0, 4, 4)
        };
    }
}
#endif
