package com.safekeymanager.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    @Size(max = 255, message = "Email must not exceed 255 characters")
    private String email;

    @NotBlank(message = "Master password is required")
    @Size(min = 12, max = 128, message = "Master password must be 12–128 characters")
    private String masterPassword;
}
