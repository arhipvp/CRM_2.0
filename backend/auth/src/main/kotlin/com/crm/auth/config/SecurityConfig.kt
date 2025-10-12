package com.crm.auth.config

import com.nimbusds.jose.jwk.source.ImmutableSecret
import java.nio.charset.StandardCharsets
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.convert.converter.Converter
import org.springframework.http.HttpMethod
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.config.annotation.method.configuration.EnableReactiveMethodSecurity
import org.springframework.security.config.web.server.ServerHttpSecurity
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter
import org.springframework.security.web.server.SecurityWebFilterChain
import reactor.core.publisher.Mono

@Configuration
@EnableReactiveMethodSecurity
class SecurityConfig(
    private val properties: JwtProperties
) {

    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun jwtEncoder(): JwtEncoder {
        val secretKey: SecretKey = SecretKeySpec(properties.secret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256")
        return NimbusJwtEncoder(ImmutableSecret(secretKey))
    }

    @Bean
    fun jwtDecoder(): ReactiveJwtDecoder {
        val secretKey = SecretKeySpec(properties.secret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256")
        return NimbusReactiveJwtDecoder.withSecretKey(secretKey)
            .macAlgorithm(MacAlgorithm.HS256)
            .build()
    }

    @Bean
    fun jwtAuthenticationConverter(): Converter<Jwt, Mono<AbstractAuthenticationToken>> {
        val delegate = org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter().apply {
            setJwtGrantedAuthoritiesConverter { jwt ->
                val roles = jwt.getClaimAsStringList("roles") ?: emptyList()
                roles.map { role -> org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_${role.removePrefix("ROLE_")}") }
            }
        }
        return ReactiveJwtAuthenticationConverterAdapter(delegate)
    }

    @Bean
    fun securityWebFilterChain(
        http: ServerHttpSecurity,
        converter: Converter<Jwt, Mono<AbstractAuthenticationToken>>,
        jwtDecoder: ReactiveJwtDecoder
    ): SecurityWebFilterChain {
        return http
            .csrf { it.disable() }
            .authorizeExchange { exchanges ->
                exchanges
                    .pathMatchers("/actuator/health", "/actuator/info").permitAll()
                    .pathMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/token", "/api/auth/refresh").permitAll()
                    .anyExchange().authenticated()
            }
            .oauth2ResourceServer { server ->
                server.jwt { jwt ->
                    jwt.jwtAuthenticationConverter(converter)
                    jwt.jwtDecoder(jwtDecoder)
                }
            }
            .build()
    }
}
