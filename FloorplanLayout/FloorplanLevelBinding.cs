using UnityEngine;

[ExecuteAlways]
[DisallowMultipleComponent]
[AddComponentMenu("BM Identity/Floorplan/Level Binding")]
public class FloorplanLevelBinding : MonoBehaviour
{
    [Header("Floorplan")]
    [Tooltip("Optional. If empty, the inspector uses the first FloorplanMasterLayout found in the open scenes.")]
    public FloorplanMasterLayout masterLayout;

    [Tooltip("Scene id from the SAMBO JSON, for example bm030.")]
    public string floorplanId;

    [Tooltip("Optional. If empty, this GameObject transform is moved.")]
    public Transform targetRoot;

    [Header("Apply")]
    public bool applyPosition = true;
    public bool applyRotation = true;

    [Tooltip("Added after JSON position conversion. Useful when the scene root needs a local offset.")]
    public Vector3 worldOffset = Vector3.zero;

    [Tooltip("Added after JSON rotation conversion.")]
    public Vector3 rotationOffsetEuler = Vector3.zero;

    public Transform Target => targetRoot != null ? targetRoot : transform;

    public void ApplyPose(Vector3 worldPosition, Quaternion worldRotation)
    {
        Transform target = Target;

        if (applyPosition)
            target.position = worldPosition + worldOffset;

        if (applyRotation)
            target.rotation = worldRotation * Quaternion.Euler(rotationOffsetEuler);
    }
}
